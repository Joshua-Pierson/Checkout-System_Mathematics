# Student and guest cart backend.
# Look up active items in MySQL by item code.
# Keep a separate cart for each student or guest session.
# Add items, change quantities, and remove items.
# Validate quantities and check available stock.
# Calculate cart totals using database prices.
# Provide API routes for frontend/js/student_cart.js.

from decimal import Decimal

import mysql.connector
from flask import Blueprint, current_app, jsonify, request, session

from checkout_db import get_connection


student_cart = Blueprint(
    "student_cart",
    __name__,
    url_prefix="/api/cart"
)

MAX_CART_ITEMS = 50
MAX_QUANTITY = 999


def find_product(connection, code):
    """Look up an item, including inactive items already in a cart."""

    with connection.cursor(dictionary=True) as cursor:
        cursor.execute(
            """
            SELECT
                i.item_code,
                i.item_name,
                i.price,
                i.stock_quantity,
                i.is_active AS item_active,
                c.is_active AS category_active
            FROM items AS i
            JOIN categories AS c
                ON c.category_id = i.category_id
            WHERE i.item_code = %s
            """,
            (code,)
        )
        return cursor.fetchone()


def build_cart(connection, quantities):
    """Calculate the cart using current database prices."""

    items = []
    warnings = []
    total = Decimal("0.00")

    for code, quantity in quantities.items():
        product = find_product(connection, code)

        if product is None:
            # Keep a removable row if a manager deleted the product.
            items.append({
                "code": code,
                "name": code,
                "price": "0.00",
                "quantity": quantity,
                "line_total": "0.00",
                "available": False
            })
            warnings.append(f"{code} no longer exists.")
            continue

        price = product["price"]
        line_total = price * quantity
        total += line_total

        available = bool(
            product["item_active"]
            and product["category_active"]
            and quantity <= product["stock_quantity"]
        )

        if not available:
            warnings.append(
                f"{product['item_name']} is unavailable "
                "or has insufficient stock."
            )

        items.append({
            "code": code,
            "name": product["item_name"],
            "price": format(price, ".2f"),
            "quantity": quantity,
            "line_total": format(line_total, ".2f"),
            "available": available
        })

    return {
        "items": items,
        "total": format(total, ".2f"),
        "warnings": warnings
    }


@student_cart.errorhandler(mysql.connector.Error)
def database_error(error):
    current_app.logger.exception("Cart database operation failed")
    return jsonify({
        "error": "Cannot access MySQL. Check the Python terminal."
    }), 503


@student_cart.errorhandler(RuntimeError)
def configuration_error(error):
    current_app.logger.exception("Cart configuration failed")
    return jsonify({
        "error": "Check the database password and backend configuration."
    }), 503


@student_cart.get("")
def view_cart():
    """Return this browser's cart and its current total."""

    quantities = dict(session.get("cart", {}))

    with get_connection() as connection:
        result = build_cart(connection, quantities)

    return jsonify(result)


@student_cart.route(
    "/items/<code>",
    methods=["POST", "PATCH", "DELETE"]
)
def change_cart_item(code):
    """
    POST: add one unit.
    PATCH: set an exact quantity.
    DELETE: remove the item.
    """

    code = code.strip().upper()

    if not code or len(code) > 30:
        return jsonify({"error": "Enter a valid item code."}), 400

    # Copy the session cart. Save it only after the operation succeeds.
    quantities = dict(session.get("cart", {}))

    with get_connection() as connection:
        if request.method == "DELETE":
            if code not in quantities:
                return jsonify({"error": "Item is not in your cart."}), 404

            del quantities[code]

        else:
            if request.method == "PATCH":
                if code not in quantities:
                    return jsonify({
                        "error": "Item is not in your cart."
                    }), 404

                data = request.get_json(silent=True)

                if not isinstance(data, dict):
                    return jsonify({
                        "error": "Send a JSON quantity."
                    }), 400

                quantity = data.get("quantity")

            else:
                quantity = quantities.get(code, 0) + 1

                if (
                    code not in quantities
                    and len(quantities) >= MAX_CART_ITEMS
                ):
                    return jsonify({
                        "error": "Your cart has reached its item limit."
                    }), 400

            # Reject decimals, strings, booleans, zero, and negatives.
            if type(quantity) is not int or not 1 <= quantity <= MAX_QUANTITY:
                return jsonify({
                    "error": f"Quantity must be a whole number from "
                    f"1 to {MAX_QUANTITY}."
                }), 400

            product = find_product(connection, code)

            if product is None:
                return jsonify({
                    "error": f'No item found for code "{code}".'
                }), 404

            if not product["item_active"] or not product["category_active"]:
                return jsonify({
                    "error": "This item is no longer available."
                }), 409

            if quantity > product["stock_quantity"]:
                return jsonify({
                    "error": f"Only {product['stock_quantity']} units "
                    "are available."
                }), 409

            quantities[code] = quantity

        result = build_cart(connection, quantities)

    # Reassign the dictionary so Flask saves the updated session.
    session["cart"] = quantities
    return jsonify(result)

# Display active products from the database.


@student_cart.get("/catalog")
def view_catalog():
    with get_connection() as connection:
        with connection.cursor(dictionary=True) as cursor:
            cursor.execute(
                """
                SELECT i.item_code, i.item_name, i.price
                FROM items AS i
                JOIN categories AS c
                    ON c.category_id = i.category_id
                WHERE i.is_active = TRUE
                  AND c.is_active = TRUE
                ORDER BY i.item_name
                """
            )
            products = cursor.fetchall()

    return jsonify({
        "products": [
            {
                "code": product["item_code"],
                "name": product["item_name"],
                "price": format(product["price"], ".2f")
            }
            for product in products
        ]
    })
