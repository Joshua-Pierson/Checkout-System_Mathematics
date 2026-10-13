import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
from mysql_dao import InventoryModel

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Instantiate the Data Access Object
dao = InventoryModel()


def get_db_connection():
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "db"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", "rootpassword"),
        database=os.environ.get("DB_NAME", "pos_inventory"),
    )


# ==========================================
# READ OPERATIONS & COMPUTATION ENGINE
# ==========================================


@app.route("/api/inventory", methods=["GET"])
def get_inventory():
    """Hydrates the frontend catalog with the exact JSON keys requested."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT item_id, name, unit_price, category, stock_quantity, tax_rate FROM inventory"
        )
        items = cursor.fetchall()

        for item in items:
            item["unit_price"] = float(item["unit_price"])
            item["tax_rate"] = float(item["tax_rate"])

        return jsonify({"status": "success", "data": items})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals():
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@app.route("/api/categories", methods=["GET"])
def get_categories():
    """Serves the authoritative list of unique categories from the catalog."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL ORDER BY category ASC"
        )
        rows = cursor.fetchall()
        categories = [row["category"] for row in rows]
        return jsonify({"status": "success", "data": categories})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals():
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@app.route("/api/cart/calculate", methods=["POST"])
def calculate_cart():
    """Provides real-time tax and subtotal calculations for the active cart."""
    data = request.get_json()
    if not data or "items" not in data:
        return jsonify({"status": "error", "message": "Invalid payload format"}), 400

    subtotal = 0.0
    total_tax = 0.0

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        for req_item in data["items"]:
            item_id = req_item.get("item_id")
            quantity = req_item.get("quantity", 1)

            cursor.execute(
                "SELECT unit_price, tax_rate FROM inventory WHERE item_id = %s",
                (item_id,),
            )
            db_item = cursor.fetchone()

            if db_item:
                price = float(db_item["unit_price"])
                tax_rate = float(db_item["tax_rate"])
                subtotal += price * quantity
                total_tax += (price * quantity) * tax_rate

        return jsonify(
            {
                "status": "success",
                "subtotal": round(subtotal, 2),
                "tax": round(total_tax, 2),
                "total": round(subtotal + total_tax, 2),
            }
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals():
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@app.route("/api/checkout", methods=["POST"])
def process_checkout():
    """Authoritative computation engine for checkout."""
    data = request.get_json()
    if not data or "items" not in data:
        return jsonify({"status": "error", "message": "Invalid payload format"}), 400

    subtotal = 0.0
    total_tax = 0.0

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        for req_item in data["items"]:
            item_id = req_item.get("item_id")
            quantity = req_item.get("quantity", 1)

            cursor.execute(
                "SELECT unit_price, tax_rate FROM inventory WHERE item_id = %s",
                (item_id,),
            )
            db_item = cursor.fetchone()

            if not db_item:
                return (
                    jsonify(
                        {"status": "error", "message": f"Item {item_id} not found"}
                    ),
                    404,
                )

            price = float(db_item["unit_price"])
            tax_rate = float(db_item["tax_rate"])

            line_total = price * quantity
            line_tax = line_total * tax_rate

            subtotal += line_total
            total_tax += line_tax

        total = subtotal + total_tax

        return jsonify(
            {
                "status": "success",
                "transaction_id": "TXN-PENDING",
                "subtotal": round(subtotal, 2),
                "tax": round(total_tax, 2),
                "total": round(total, 2),
            }
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals():
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


# ==========================================
# CATALOG MUTATION ENDPOINTS (DAO INTEGRATION)
# ==========================================


@app.route("/api/items", methods=["POST"])
def create_item():
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Missing JSON payload"}), 400
    try:
        new_item_id = dao.add_item(data)
        return (
            jsonify(
                {"status": "success", "message": "Item created", "item_id": new_item_id}
            ),
            201,
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/items/<int:item_id>", methods=["PUT"])
def update_item_route(item_id):
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Missing JSON payload"}), 400
    try:
        success = dao.update_item(item_id, data)
        if success:
            return (
                jsonify({"status": "success", "message": f"Item {item_id} updated"}),
                200,
            )
        else:
            return (
                jsonify({"status": "error", "message": f"Item {item_id} not found"}),
                404,
            )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/items/<int:item_id>", methods=["DELETE"])
def delete_item_route(item_id):
    try:
        success = dao.delete_item(item_id)
        if success:
            return (
                jsonify({"status": "success", "message": f"Item {item_id} deleted"}),
                200,
            )
        else:
            return (
                jsonify({"status": "error", "message": f"Item {item_id} not found"}),
                404,
            )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
