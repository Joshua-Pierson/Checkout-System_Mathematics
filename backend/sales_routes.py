"""API routes for sales and inventory levels.

POST /api/sales                  -> save a paid sale + subtract stock
GET  /api/sales/<sale_id>        -> get a saved sale (receipt data)
GET  /api/inventory/levels       -> stock levels for the manager
     optional: ?category=drinks  ?low_stock=true  ?threshold=5
"""
from flask import Blueprint, jsonify, request

from sales_dao import SaleError

sales_bp = Blueprint("sales", __name__)
_sales_dao = None


def init_sales_routes(app, sales_dao):
    """Call once in server.py to turn these routes on."""
    global _sales_dao
    _sales_dao = sales_dao
    app.register_blueprint(sales_bp)


@sales_bp.route("/api/sales", methods=["POST"])
def create_sale():
    data = request.get_json(silent=True) or {}
    try:
        sale = _sales_dao.record_sale(
            items=data.get("items"),
            payment_method=data.get("payment_method"),
            cash_received=data.get("cash_received"),
        )
    except SaleError as err:
        return jsonify({"status": "error", "message": str(err)}), err.status
    return jsonify({"status": "success", "data": sale}), 201


@sales_bp.route("/api/sales/<int:sale_id>", methods=["GET"])
def get_sale(sale_id):
    sale = _sales_dao.get_sale(sale_id)
    if sale is None:
        return jsonify({"status": "error", "message": "Sale not found"}), 404
    return jsonify({"status": "success", "data": sale}), 200


@sales_bp.route("/api/inventory/levels", methods=["GET"])
def inventory_levels():
    try:
        threshold = int(request.args.get("threshold", 5))
    except ValueError:
        return jsonify({"status": "error", "message": "threshold must be a number"}), 400
    items = _sales_dao.get_inventory_levels(
        category=request.args.get("category"),
        low_stock_only=request.args.get("low_stock", "").lower() == "true",
        low_stock_threshold=threshold,
    )
    return jsonify({"status": "success", "data": items}), 200
