import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import mysql.connector
from mysql_dao import InventoryModel
from receipt_service import generate_receipt
from card_payment import authorize_card, CardDeclined
from discount_service import calculate_discounts, apply_multibuy
from discount_dao import DiscountDAO 
from course_dao import CourseDAO
from auth_service import AuthService
from audit_dao import AuditDAO

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
dao = InventoryModel()
discount_dao_manager = DiscountDAO(dao)
course_dao_manager = CourseDAO(dao)
auth_manager = AuthService(dao)
audit_dao_manager = AuditDAO(dao)

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
    employee_id = data.get("employee_id", "")
    
    subtotal = 0.0
    total_tax = 0.0
    receipt_items = []

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        multibuy_rules = discount_dao_manager.get_multibuy_rules()
        
        for req_item in data["items"]:
            item_id = req_item.get("item_id")
            quantity = req_item.get("quantity", 1)
            
            cursor.execute("SELECT name, unit_price, tax_rate, category FROM inventory WHERE item_id = %s", (item_id,))
            db_item = cursor.fetchone()
            
            if db_item:
                price = float(db_item["unit_price"])
                rule = multibuy_rules.get(item_id)
                line_tot, bundle_applied = apply_multibuy(price, quantity, rule)
                
                receipt_items.append({
                    "item_id": item_id,
                    "name": db_item["name"],
                    "category": db_item["category"],
                    "price": price,
                    "quantity": quantity,
                    "line_total": line_tot,
                    "bundle_applied": bundle_applied,
                    "bundle_trigger": rule["trigger"] if bundle_applied else None,
                    "bundle_price": rule["price"] if bundle_applied else None,
                    "tax_rate": float(db_item["tax_rate"])
                })

        eligibility_map = discount_dao_manager.get_eligibility_map()
        discount_rules = discount_dao_manager.get_discount_rules()

        discount_info = calculate_discounts(receipt_items, student_id, employee_id, eligibility_map, discount_rules)
        discount_total = discount_info["amount"]

        for item in receipt_items:
            subtotal += item["line_total"]
            discounted_line = item["line_total"] - item["discount"]
            total_tax += discounted_line * item["tax_rate"]

        total_due = subtotal - discount_total + total_tax

        return jsonify({
            "status": "success",
            "subtotal": round(subtotal, 2),
            "discount": round(discount_total, 2),
            "discount_type": discount_info["type"],
            "tax": round(total_tax, 2),
            "total": round(total_due, 2),
            "items": receipt_items
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals(): cursor.close()
        if "conn" in locals() and conn.is_connected(): conn.close()

@app.route("/api/cart/course", methods=["POST"])
def add_course_bundle():
    """Evaluate course bundle item quantities against current inventory stock."""
    data = request.get_json()
    if not data or "course_code" not in data:
        return jsonify({"status": "error", "message": "Missing course_code in payload"}), 400

    course_code = str(data["course_code"]).strip().upper()

    try:
        bundle_items = course_dao_manager.get_course_bundle(course_code)
        if not bundle_items:
            return jsonify({
                "status": "error",
                "message": f"No bundle found for course {course_code}"
            }), 404

        added_items = []
        out_of_stock_items = []

        for item in bundle_items:
            required_quantity = int(item["required_quantity"])
            stock_quantity = int(item["stock_quantity"])
            if stock_quantity >= required_quantity:
                added_items.append({
                    "item_id": item["item_id"],
                    "name": item["name"],
                    "price": float(item["unit_price"]),
                    "quantity": required_quantity,
                    "category": item["category"]
                })
            else:
                out_of_stock_items.append({
                    "item_id": item["item_id"],
                    "name": item["name"],
                    "requested_quantity": required_quantity,
                    "available_stock": stock_quantity
                })

        return jsonify({
            "status": "success",
            "course_code": course_code,
            "added": added_items,
            "out_of_stock": out_of_stock_items
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/checkout/cash", methods=["POST"])
def process_cash_checkout():
    data = request.get_json()
    if not data or "cart" not in data or "cash_tendered" not in data:
        return jsonify({"status": "error", "message": "Malformed payload."}), 400

    cart = data["cart"]
    student_id = data.get("student_id", "")
    employee_id = data.get("employee_id", "")
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
        multibuy_rules = discount_dao_manager.get_multibuy_rules()

        for req_item in cart:
            item_id = req_item.get("item_id")
            quantity = req_item.get("quantity", 1)

            cursor.execute("SELECT name, unit_price, tax_rate, stock_quantity, category FROM inventory WHERE item_id = %s", (item_id,))
            db_item = cursor.fetchone()

            if not db_item:
                return jsonify({"status": "error", "message": f"Item {item_id} not found."}), 404
            if int(db_item["stock_quantity"]) < quantity:
                return jsonify({"status": "error", "message": f"Insufficient stock for item {item_id}."}), 409

            price = float(db_item["unit_price"])
            rule = multibuy_rules.get(item_id)
            line_tot, bundle_applied = apply_multibuy(price, quantity, rule)

            receipt_items.append({
                "item_id": item_id,
                "name": db_item["name"],
                "category": db_item["category"],
                "quantity": quantity,
                "price": price,
                "line_total": line_tot,
                "bundle_applied": bundle_applied,
                "bundle_trigger": rule["trigger"] if bundle_applied else None,
                "bundle_price": rule["price"] if bundle_applied else None,
                "tax_rate": float(db_item["tax_rate"])
            })

        eligibility_map = discount_dao_manager.get_eligibility_map()
        discount_rules = discount_dao_manager.get_discount_rules()

        discount_info = calculate_discounts(receipt_items, student_id, employee_id, eligibility_map, discount_rules)
        discount_total = discount_info["amount"]

        for item in receipt_items:
            subtotal += item["line_total"]
            discounted_line = item["line_total"] - item["discount"]
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
            total_tax=total_tax,
            total_due=total_due,
            payment_method="cash",
            payment_details={"cash_tendered": cash_tendered, "change_due": change_due},
            discount_info=discount_info
        )

        return jsonify({
            "status": "success",
            "subtotal": round(subtotal, 2),
            "discount": round(discount_total, 2),
            "discount_type": discount_info["type"],
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
    employee_id = data.get("employee_id", "")
    
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
        multibuy_rules = discount_dao_manager.get_multibuy_rules()

        for req_item in cart:
            item_id = req_item.get("item_id")
            quantity = req_item.get("quantity", 1)

            cursor.execute("SELECT name, unit_price, tax_rate, stock_quantity, category FROM inventory WHERE item_id = %s", (item_id,))
            db_item = cursor.fetchone()

            if not db_item:
                return jsonify({"status": "error", "message": f"Item {item_id} not found."}), 404
            if int(db_item["stock_quantity"]) < quantity:
                return jsonify({"status": "error", "message": f"Insufficient stock for item {item_id}."}), 409

            price = float(db_item["unit_price"])
            rule = multibuy_rules.get(item_id)
            line_tot, bundle_applied = apply_multibuy(price, quantity, rule)

            receipt_items.append({
                "item_id": item_id,
                "name": db_item["name"],
                "category": db_item["category"],
                "quantity": quantity,
                "price": price,
                "line_total": line_tot,
                "bundle_applied": bundle_applied,
                "bundle_trigger": rule["trigger"] if bundle_applied else None,
                "bundle_price": rule["price"] if bundle_applied else None,
                "tax_rate": float(db_item["tax_rate"])
            })

        eligibility_map = discount_dao_manager.get_eligibility_map()
        discount_rules = discount_dao_manager.get_discount_rules()

        discount_info = calculate_discounts(receipt_items, student_id, employee_id, eligibility_map, discount_rules)
        discount_total = discount_info["amount"]

        for item in receipt_items:
            subtotal += item["line_total"]
            discounted_line = item["line_total"] - item["discount"]
            total_tax += discounted_line * item["tax_rate"]

        total_due = round(subtotal - discount_total + total_tax, 2)

        for item in receipt_items:
            dao.decrement_stock(item["item_id"], item["quantity"])

        receipt_data = generate_receipt(
            cart_items=receipt_items,
            subtotal=subtotal,
            total_tax=total_tax,
            total_due=total_due,
            payment_method="card",
            payment_details={"card_last4": card_last4},
            discount_info=discount_info
        )

        return jsonify({
            "status": "success",
            "subtotal": round(subtotal, 2),
            "discount": round(discount_total, 2),
            "discount_type": discount_info["type"],
            "total_due": total_due,
            "card_last4": card_last4,
            "receipt": receipt_data
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals(): cursor.close()
        if "conn" in locals() and conn.is_connected(): conn.close()

# ---------------------------------------------------------
# CATALOG & MANAGER ENDPOINTS
# ---------------------------------------------------------

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

@app.route("/api/discounts/categories", methods=["GET"])
def get_discount_eligibilities():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL")
        all_cats = [row["category"] for row in cursor.fetchall()]
        
        eligibility_map = discount_dao_manager.get_eligibility_map()
        
        results = []
        for cat in all_cats:
            results.append({
                "category": cat,
                "student_eligible": eligibility_map.get(cat, {}).get("student", False),
                "employee_eligible": eligibility_map.get(cat, {}).get("employee", True)
            })
        return jsonify({"status": "success", "data": results})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if "cursor" in locals(): cursor.close()
        if "conn" in locals() and conn.is_connected(): conn.close()

@app.route("/api/discounts/categories/<string:category>", methods=["PUT"])
def update_discount_eligibility(category):
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Missing JSON payload"}), 400
        
    student_eligible = data.get("student_eligible", False)
    employee_eligible = data.get("employee_eligible", True)
    
    try:
        discount_dao_manager.update_eligibility(category, student_eligible, employee_eligible)
        return jsonify({"status": "success", "message": f"Updated eligibility for {category}"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/discounts/rules", methods=["GET"])
def get_discount_rules():
    try:
        rules = discount_dao_manager.get_discount_rules()
        return jsonify({"status": "success", "data": rules})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/discounts/rules/<string:profile>", methods=["PUT"])
def update_discount_rule(profile):
    data = request.get_json()
    if not data or "discount_type" not in data or "discount_value" not in data:
        return jsonify({"status": "error", "message": "Missing JSON payload parameters"}), 400
        
    try:
        discount_dao_manager.update_discount_rule(
            profile_name=profile,
            discount_type=data["discount_type"],
            discount_value=data["discount_value"]
        )
        return jsonify({"status": "success", "message": f"Updated rule for {profile}"}), 200
    except ValueError as ve:
        return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/discounts/bundles", methods=["GET"])
def get_multibuy_bundles():
    try:
        rules = discount_dao_manager.get_multibuy_rules()
        return jsonify({"status": "success", "data": rules})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/discounts/bundles/<int:item_id>", methods=["PUT"])
def update_multibuy_bundle(item_id):
    data = request.get_json()
    if not data or "trigger_quantity" not in data or "bundle_price" not in data:
        return jsonify({"status": "error", "message": "Missing payload parameters"}), 400
        
    try:
        discount_dao_manager.update_multibuy_rule(item_id, data["trigger_quantity"], data["bundle_price"])
        return jsonify({"status": "success", "message": f"Bundle updated for item {item_id}"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/discounts/bundles/<int:item_id>", methods=["DELETE"])
def delete_multibuy_bundle(item_id):
    try:
        success = discount_dao_manager.delete_multibuy_rule(item_id)
        if success:
            return jsonify({"status": "success", "message": f"Bundle deleted for item {item_id}"}), 200
        return jsonify({"status": "error", "message": "Bundle not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/auth/login", methods=["POST"])
def staff_login():
    """Authenticates a staff member for override actions."""
    data = request.get_json()
    if not data or "staff_id" not in data or "pin" not in data:
        return jsonify({"status": "error", "message": "Missing staff_id or pin in payload"}), 400
        
    try:
        is_authenticated, staff_profile = auth_manager.verify_staff_credentials(data["staff_id"], data["pin"])
        
        if not is_authenticated:
            return jsonify({
                "status": "error", 
                "message": "Authentication failed: Invalid Staff ID or PIN."
            }), 401
            
        return jsonify({
            "status": "success",
            "message": "Login successful.",
            "staff": staff_profile
        }), 200
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/staff", methods=["POST"])
def register_staff():
    """Allows managers to dynamically provision new employees from the React UI."""
    data = request.get_json()
    if not data or not all(k in data for k in ("staff_id", "name", "pin", "role")):
        return jsonify({"status": "error", "message": "Missing required fields"}), 400
        
    try:
        auth_manager.create_staff(
            staff_id=data["staff_id"],
            name=data["name"],
            pin=data["pin"],
            role=data["role"]
        )
        return jsonify({
            "status": "success",
            "message": f"Staff member {data['name']} registered successfully."
        }), 201
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/cart/override/item", methods=["DELETE"])
def authorize_item_removal():
    """
    Acts as a secure gateway for removing items from a student's active transaction.
    Requires valid staff credentials. If authorized, permanently logs the event.
    """
    data = request.get_json()
    
    # Enforce strict payload requirements
    if not data or not all(k in data for k in ("staff_id", "pin", "item_id")):
        return jsonify({"status": "error", "message": "Missing staff credentials or item_id in payload"}), 400
        
    staff_id = data["staff_id"]
    pin = data["pin"]
    item_id = data["item_id"]
    
    try:
        # 1. Evaluate Staff Credentials
        is_authenticated, staff_profile = auth_manager.verify_staff_credentials(staff_id, pin)
        
        if not is_authenticated:
            return jsonify({
                "status": "error", 
                "message": "Override denied: Invalid Staff ID or PIN."
            }), 401
            
        # 2. Persist the Override Event to the Immutable Ledger
        audit_dao_manager.log_override(
            staff_id=staff_id, 
            action_type="REMOVE_ITEM", 
            item_id=item_id, 
            details=f"Item removal authorized by {staff_profile['name']}"
        )
        
        # 3. Issue Authorization
        return jsonify({
            "status": "success",
            "message": "Item removal authorized and logged.",
            "authorized_by": staff_profile["name"]
        }), 200
        
    except ValueError:
        return jsonify({"status": "error", "message": "item_id must be a valid integer."}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/cart/override/price", methods=["PUT"])
def authorize_price_override():
    """
    Acts as a secure gateway for mutating an item's price in the active cart.
    Requires valid staff credentials and a justification reason. 
    """
    data = request.get_json()
    
    required_fields = ("staff_id", "pin", "item_id", "original_price", "new_price", "reason")
    if not data or not all(k in data for k in required_fields):
        return jsonify({"status": "error", "message": "Missing required fields in payload"}), 400
        
    staff_id = data["staff_id"]
    pin = data["pin"]
    item_id = data["item_id"]
    reason = data["reason"]
    
    if not str(reason).strip():
        return jsonify({"status": "error", "message": "A reason must be provided for price overrides."}), 400
    
    try:
        original_price = float(data["original_price"])
        new_price = float(data["new_price"])
        
        if new_price < 0:
            return jsonify({"status": "error", "message": "New price cannot be negative."}), 400

        # 1. Evaluate Staff Credentials
        is_authenticated, staff_profile = auth_manager.verify_staff_credentials(staff_id, pin)
        
        if not is_authenticated:
            return jsonify({
                "status": "error", 
                "message": "Override denied: Invalid Staff ID or PIN."
            }), 401
            
        # 2. Persist the Mutation Event to the Immutable Ledger
        audit_dao_manager.log_price_override(
            staff_id=staff_id, 
            item_id=item_id, 
            original_price=original_price,
            new_price=new_price,
            reason=f"Authorized by {staff_profile['name']}. Reason: {reason}"
        )
        
        # 3. Issue Authorization
        return jsonify({
            "status": "success",
            "message": "Price override authorized and logged.",
            "authorized_by": staff_profile["name"],
            "new_price": round(new_price, 2)
        }), 200
        
    except ValueError:
        return jsonify({"status": "error", "message": "Prices and item_id must be valid numbers."}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/courses/<string:course_code>", methods=["GET"])
def lookup_course_bundle(course_code):
    """
    Retrieves the required items for a course and their live stock levels.
    Designed strictly for frontend hydration, completely decoupled from cart state.
    """
    try:
        # Leverage the existing DAO infrastructure
        bundle_items = course_dao_manager.get_course_bundle(course_code)
        
        if not bundle_items:
            return jsonify({"status": "error", "message": f"No supplies cataloged for course {course_code.upper()}"}), 404
            
        results = []
        for item in bundle_items:
            results.append({
                "item_id": item["item_id"],
                "name": item["name"],
                "category": item["category"],
                "price": float(item["unit_price"]),
                "required_quantity": int(item["required_quantity"]),
                "available_stock": int(item["stock_quantity"]),
                "in_stock": int(item["stock_quantity"]) >= int(item["required_quantity"])
            })
            
        return jsonify({
            "status": "success",
            "course_code": course_code.upper(),
            "supplies": results
        }), 200
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)