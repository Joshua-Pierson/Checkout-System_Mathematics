"""Catalog API (search, browse, grouping).

GET  /api/items/search?q=calc            -> items whose name contains "calc" (or code = "calc")
GET  /api/categories/summary             -> [{"category", "item_count", "in_stock_count"}]
     (plain /api/categories with just the names lives in main.py)
GET  /api/categories/<category>/items    -> items in that category
GET  /api/catalog/grouped                -> {"books": [...], "drinks": [...]}
POST /api/categories/normalize           -> manager: clean up all category names
"""
from flask import Blueprint, jsonify, request

catalog_bp = Blueprint("catalog", __name__)
_catalog_dao = None


def init_catalog_routes(app, catalog_dao):
    global _catalog_dao
    _catalog_dao = catalog_dao
    app.register_blueprint(catalog_bp)


@catalog_bp.route("/api/items/search", methods=["GET"])
def search_items():
    text = request.args.get("q", "")
    if not text.strip():
        return jsonify({"status": "error", "message": "Add search text, e.g. ?q=calculator"}), 400
    if len(text) > 100:
        return jsonify({"status": "error", "message": "Search text is too long"}), 400
    return jsonify({"status": "success", "data": _catalog_dao.search_items(text)}), 200


@catalog_bp.route("/api/categories/summary", methods=["GET"])
def list_categories():
    return jsonify({"status": "success", "data": _catalog_dao.list_categories()}), 200


@catalog_bp.route("/api/categories/<category>/items", methods=["GET"])
def items_in_category(category):
    items = _catalog_dao.items_in_category(category)
    if not items:
        return jsonify({"status": "error", "message": f"No items in category: {category}"}), 404
    return jsonify({"status": "success", "data": items}), 200


@catalog_bp.route("/api/catalog/grouped", methods=["GET"])
def grouped_catalog():
    return jsonify({"status": "success", "data": _catalog_dao.grouped_catalog()}), 200


@catalog_bp.route("/api/categories/normalize", methods=["POST"])
def normalize_categories():
    changes = _catalog_dao.normalize_all_categories()
    return jsonify({"status": "success", "data": {"renamed": changes}}), 200
