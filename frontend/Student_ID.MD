from flask import Flask, send_from_directory, request, jsonify
from checkout_system import CartItem, calculate_checkout
import os

app = Flask(__name__)

INVENTORY = {
    "ITEM1": {"name": "Textbook", "price": 45.00, "category": "Books", "is_eligible": True},
    "ITEM2": {"name": "Notebook", "price": 5.50, "category": "Supplies", "is_eligible": True},
    "ITEM3": {"name": "Scientific Calculator", "price": 20.00, "category": "Tech", "is_eligible": False}
}

@app.route('/')
def home():
    return send_from_directory(os.path.dirname(os.path.abspath(__file__)), 'cart.html')

@app.route('/checkout', methods=['POST'])
def checkout():
    data = request.get_json()
    student_id = data.get('student_id', '').strip()
    cart_codes = data.get('cart_items', [])
    is_verified = len(student_id) > 0
    
    cart_objects = []
    for code in cart_codes:
        if code in INVENTORY:
            item_data = INVENTORY[code]
            cart_objects.append(
                CartItem(item_data["name"], item_data["price"], 1, item_data["category"], item_data["is_eligible"])
            )
            
    result = calculate_checkout(cart_objects, student_id_verified=is_verified)
    result["student_id_verified"] = is_verified
    result["student_id"] = student_id
    
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, port=5500)