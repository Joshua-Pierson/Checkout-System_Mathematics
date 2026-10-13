"""Manager API for tax-exempt settings.

PUT /api/items/<item_id>/tax-exempt        (item_id is a number) body: {"tax_exempt": true}
PUT /api/categories/<category>/tax-exempt  body: {"tax_exempt": true}
GET /api/tax-exemptions                    -> {"categories": [...], "items": [...]}
"""
from flask import Blueprint, jsonify, request

from tax_dao import NotFound

tax_bp = Blueprint("tax", __name__)
_tax_dao = None


def init_tax_routes(app, tax_dao):
    global _tax_dao
    _tax_dao = tax_dao
    app.register_blueprint(tax_bp)


def _read_flag():
    data = request.get_json(silent=True) or {}
    flag = data.get("tax_exempt")
    if not isinstance(flag, bool):
        return None
    return flag


@tax_bp.route("/api/items/<int:item_id>/tax-exempt", methods=["PUT"])
def set_item_exempt(item_id):
    flag = _read_flag()
    if flag is None:
        return jsonify({"status": "error", "message": "tax_exempt must be true or false"}), 400
    try:
        _tax_dao.set_item_exempt(item_id, flag)
    except NotFound as err:
        return jsonify({"status": "error", "message": str(err)}), 404
    return jsonify({"status": "success", "data": {"item_id": item_id, "tax_exempt": flag}}), 200


@tax_bp.route("/api/categories/<category>/tax-exempt", methods=["PUT"])
def set_category_exempt(category):
    flag = _read_flag()
    if flag is None:
        return jsonify({"status": "error", "message": "tax_exempt must be true or false"}), 400
    try:
        _tax_dao.set_category_exempt(category, flag)
    except NotFound as err:
        return jsonify({"status": "error", "message": str(err)}), 404
    return jsonify({"status": "success", "data": {"category": category, "tax_exempt": flag}}), 200


@tax_bp.route("/api/tax-exemptions", methods=["GET"])
def list_exemptions():
    return jsonify({"status": "success", "data": _tax_dao.list_exemptions()}), 200
