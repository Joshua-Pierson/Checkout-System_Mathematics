import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import mysql.connector
from mysql_dao import InventoryModel
from receipt_service import generate_receipt
from card_payment import authorize_card, CardDeclined
from discount_service import calculate_discounts

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
dao = InventoryModel()

def get_db_connection():
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "db"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", "rootpassword"),
        database=os.environ.get("DB_NAME", "pos_inventory"),
    )

@app.route("/api/inventory", methods=["GET"])
def get_inventory():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT item_id, name, unit_price, category, stock_quantity, tax_rate FROM inventory")
        items = cursor.fetchall()
        for item in items:
            item["unit_price"] = float(item["unit_price"])
            item["tax_rate"] = float(item["tax_rate"])
        return jsonify({"status": "success", "data": items})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals(): cursor.close()
        if "conn" in locals() and conn.is_connected(): conn.close()

@app.route("/api/categories", methods=["GET"])
def get_categories():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL ORDER BY category ASC")
        categories = [row["category"] for row in cursor.fetchall()]
        return jsonify({"status": "success", "data": categories})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals(): cursor.close()
        if "conn" in locals() and conn.is_connected(): conn.close()

@app.route("/api/cart/calculate", methods=["POST"])
def calculate_cart():
    data = request.get_json()
    if not data or "items" not in data:
        return jsonify({"status": "error", "message": "Invalid payload format"}), 400

    student_id = data.get("student_id", "")
    subtotal = 0.0
    total_tax = 0.0
    receipt_items = []

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        for req_item in data["items"]:
            item_id = req_item.get("item_id")
            quantity = req_item.get("quantity", 1)
            
            cursor.execute("SELECT name, unit_price, tax_rate, category FROM inventory WHERE item_id = %s", (item_id,))
            db_item = cursor.fetchone()
            
            if db_item:
                receipt_items.append({
                    "name": db_item["name"],
                    "category": db_item["category"],
                    "price": float(db_item["unit_price"]),
                    "quantity": quantity,
                    "tax_rate": float(db_item["tax_rate"])
                })

        is_student, discount_total = calculate_discounts(receipt_items, student_id)

        for item in receipt_items:
            line_total = item["price"] * item["quantity"]
            subtotal += line_total
            # Calculate tax on the discounted line total
            discounted_line = line_total - item["discount"]
            total_tax += discounted_line * item["tax_rate"]

        total_due = subtotal - discount_total + total_tax

        return jsonify({
            "status": "success",
            "subtotal": round(subtotal, 2),
            "discount": round(discount_total, 2),
            "tax": round(total_tax, 2),
            "total": round(total_due, 2),
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals(): cursor.close()
        if "conn" in locals() and conn.is_connected(): conn.close()

@app.route("/api/checkout/cash", methods=["POST"])
def process_cash_checkout():
    data = request.get_json()
    if not data or "cart" not in data or "cash_tendered" not in data:
        return jsonify({"status": "error", "message": "Malformed payload."}), 400

    cart = data["cart"]
    student_id = data.get("student_id", "")
    try:
        cash_tendered = float(data["cash_tendered"])
    except ValueError:
        return jsonify({"status": "error", "message": "cash_tendered must be a numerical float."}), 400

    subtotal = 0.0
    total_tax = 0.0
    receipt_items = []

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        for req_item in cart:
            item_id = req_item.get("item_id")
            quantity = req_item.get("quantity", 1)

            cursor.execute("SELECT name, unit_price, tax_rate, stock_quantity, category FROM inventory WHERE item_id = %s", (item_id,))
            db_item = cursor.fetchone()

            if not db_item:
                return jsonify({"status": "error", "message": f"Item {item_id} not found."}), 404
            if int(db_item["stock_quantity"]) < quantity:
                return jsonify({"status": "error", "message": f"Insufficient stock for item {item_id}."}), 409

            receipt_items.append({
                "item_id": item_id,
                "name": db_item["name"],
                "category": db_item["category"],
                "quantity": quantity,
                "price": float(db_item["unit_price"]),
                "tax_rate": float(db_item["tax_rate"])
            })

        is_student, discount_total = calculate_discounts(receipt_items, student_id)

        for item in receipt_items:
            line_total = item["price"] * item["quantity"]
            subtotal += line_total
            discounted_line = line_total - item["discount"]
            total_tax += discounted_line * item["tax_rate"]

        total_due = round(subtotal - discount_total + total_tax, 2)

        if cash_tendered < total_due:
            deficit = round(total_due - cash_tendered, 2)
            return jsonify({"status": "error", "message": "Insufficient payment", "amount_due": total_due, "deficit": deficit}), 400

        for item in receipt_items:
            dao.decrement_stock(item["item_id"], item["quantity"])

        change_due = round(cash_tendered - total_due, 2)

        receipt_data = generate_receipt(
            cart_items=receipt_items,
            subtotal=subtotal,
            total_discount=discount_total,
            total_tax=total_tax,
            total_due=total_due,
            payment_method="cash",
            payment_details={"cash_tendered": cash_tendered, "change_due": change_due},
            student_id=student_id if is_student else None
        )

        return jsonify({
            "status": "success",
            "subtotal": round(subtotal, 2),
            "discount": round(discount_total, 2),
            "total_due": total_due,
            "cash_tendered": cash_tendered,
            "change_due": change_due,
            "receipt": receipt_data
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals(): cursor.close()
        if "conn" in locals() and conn.is_connected(): conn.close()

@app.route("/api/checkout/card", methods=["POST"])
def process_card_checkout():
    data = request.get_json()
    if not data or "cart" not in data or "card_number" not in data:
        return jsonify({"status": "error", "message": "Malformed payload."}), 400

    cart = data["cart"]
    card_number = str(data["card_number"])
    student_id = data.get("student_id", "")
    
    try:
        card_last4 = authorize_card(card_number)
    except ValueError as ve:
        return jsonify({"status": "error", "message": str(ve)}), 400
    except CardDeclined as cd:
        return jsonify({"status": "error", "message": str(cd)}), 402

    subtotal = 0.0
    total_tax = 0.0
    receipt_items = []

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        for req_item in cart:
            item_id = req_item.get("item_id")
            quantity = req_item.get("quantity", 1)

            cursor.execute("SELECT name, unit_price, tax_rate, stock_quantity, category FROM inventory WHERE item_id = %s", (item_id,))
            db_item = cursor.fetchone()

            if not db_item:
                return jsonify({"status": "error", "message": f"Item {item_id} not found."}), 404
            if int(db_item["stock_quantity"]) < quantity:
                return jsonify({"status": "error", "message": f"Insufficient stock for item {item_id}."}), 409

            receipt_items.append({
                "item_id": item_id,
                "name": db_item["name"],
                "category": db_item["category"],
                "quantity": quantity,
                "price": float(db_item["unit_price"]),
                "tax_rate": float(db_item["tax_rate"])
            })

        is_student, discount_total = calculate_discounts(receipt_items, student_id)

        for item in receipt_items:
            line_total = item["price"] * item["quantity"]
            subtotal += line_total
            discounted_line = line_total - item["discount"]
            total_tax += discounted_line * item["tax_rate"]

        total_due = round(subtotal - discount_total + total_tax, 2)

        for item in receipt_items:
            dao.decrement_stock(item["item_id"], item["quantity"])

        receipt_data = generate_receipt(
            cart_items=receipt_items,
            subtotal=subtotal,
            total_discount=discount_total,
            total_tax=total_tax,
            total_due=total_due,
            payment_method="card",
            payment_details={"card_last4": card_last4},
            student_id=student_id if is_student else None
        )

        return jsonify({
            "status": "success",
            "subtotal": round(subtotal, 2),
            "discount": round(discount_total, 2),
            "total_due": total_due,
            "card_last4": card_last4,
            "receipt": receipt_data
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals(): cursor.close()
        if "conn" in locals() and conn.is_connected(): conn.close()

@app.route("/api/items", methods=["POST"])
def create_item():
    data = request.get_json()
    try:
        new_item_id = dao.add_item(data)
        return jsonify({"status": "success", "message": "Item created", "item_id": new_item_id}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/items/<int:item_id>", methods=["PUT"])
def update_item_route(item_id):
    data = request.get_json()
    try:
        success = dao.update_item(item_id, data)
        if success:
            return jsonify({"status": "success", "message": f"Item {item_id} updated"}), 200
        return jsonify({"status": "error", "message": f"Item {item_id} not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/items/<int:item_id>", methods=["DELETE"])
def delete_item_route(item_id):
    try:
        success = dao.delete_item(item_id)
        if success:
            return jsonify({"status": "success", "message": f"Item {item_id} deleted"}), 200
        return jsonify({"status": "error", "message": f"Item {item_id} not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/receipts/<transaction_id>", methods=["GET"])
def get_receipt(transaction_id):
    receipts_dir = os.path.join(os.path.dirname(__file__), "receipts")
    filename = f"receipt_{transaction_id}.txt"
    if os.path.exists(os.path.join(receipts_dir, filename)):
        return send_from_directory(receipts_dir, filename)
    return jsonify({"status": "error", "message": "Receipt not found"}), 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)