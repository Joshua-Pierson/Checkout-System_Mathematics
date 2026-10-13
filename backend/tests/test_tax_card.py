"""Tests for tax-exempt settings and card payments."""
import pytest
from flask import Flask

from card_payment import CardDeclined, authorize_card
from sales_dao import SaleError
from tax_dao import NotFound, TaxDAO
from tax_routes import init_tax_routes

APPROVED = "4242 4242 4242 4242"
DECLINED = "4000 0000 0000 0002"


@pytest.fixture()
def tax(inventory_dao):
    return TaxDAO(inventory_dao)


def stock(dao, item_id):
    return {i["item_id"]: i["stock_quantity"] for i in dao.get_inventory_levels()}[item_id]


# ---------- card checks (no database needed) ----------
def test_card_rules():
    assert authorize_card(APPROVED) == "4242"
    assert authorize_card("4242-4242-4242-4242") == "4242"
    with pytest.raises(CardDeclined):
        authorize_card(DECLINED)
    for bad in [None, "", "1234", "4242 4242 4242 4241", "abcd efgh ijkl mnop"]:
        with pytest.raises(ValueError):
            authorize_card(bad)


# ---------- card payments in checkout ----------
def test_card_sale_saves_only_last4(dao):
    sale = dao.record_sale([{"item_id": 1003, "quantity": 1}], "card", card_number=APPROVED)
    assert sale["card_last4"] == "4242"
    assert sale["amount_paid"] == sale["total"] and sale["change_due"] == 0
    assert "4242424242424242" not in str(sale)


def test_declined_card_saves_nothing(dao):
    with pytest.raises(SaleError) as err:
        dao.record_sale([{"item_id": 1003, "quantity": 1}], "card", card_number=DECLINED)
    assert err.value.status == 402
    assert stock(dao, 1003) == 3 and dao.get_sale(1) is None


def test_missing_or_invalid_card_is_400(dao):
    for number in [None, "1234"]:
        with pytest.raises(SaleError) as err:
            dao.record_sale([{"item_id": 1003, "quantity": 1}], "card", card_number=number)
        assert err.value.status == 400


def test_cash_sale_has_no_card(dao):
    sale = dao.record_sale([{"item_id": 1003, "quantity": 1}], "cash", cash_received=5)
    assert sale["card_last4"] is None


def test_non_numeric_cash_is_400(dao):
    with pytest.raises(SaleError) as err:
        dao.record_sale([{"item_id": 1003, "quantity": 1}], "cash", cash_received="abc")
    assert err.value.status == 400


# ---------- tax-exempt ----------
def test_item_exempt_removes_tax(dao, tax):
    taxed = dao.record_sale([{"item_id": 1002, "quantity": 1}], "card", card_number=APPROVED)
    assert taxed["tax"] == 9.49
    tax.set_item_exempt(1002, True)
    free = dao.record_sale([{"item_id": 1002, "quantity": 1}], "card", card_number=APPROVED)
    assert free["tax"] == 0 and free["total"] == 115.00
    tax.set_item_exempt(1002, False)
    again = dao.record_sale([{"item_id": 1002, "quantity": 1}], "card", card_number=APPROVED)
    assert again["tax"] == 9.49        # original 8.25% rate is kept, not lost


def test_category_exempt_removes_tax(dao, tax):
    tax.set_category_exempt("exam supplies", True)
    sale = dao.record_sale([{"item_id": 1003, "quantity": 2},
                            {"item_id": 1002, "quantity": 1}], "card", card_number=APPROVED)
    assert sale["tax"] == 9.49         # only the calculator is taxed
    lines = {line["item_id"]: line["tax_rate"] for line in sale["items"]}
    assert lines == {1002: 0.0825, 1003: 0.0}
    assert tax.list_exemptions() == {"categories": ["exam supplies"], "items": []}
    tax.set_category_exempt("exam supplies", True)   # setting twice is fine
    tax.set_category_exempt("exam supplies", False)
    assert tax.list_exemptions()["categories"] == []


def test_unknown_item_or_category(tax):
    with pytest.raises(NotFound):
        tax.set_item_exempt(9999, True)
    with pytest.raises(NotFound):
        tax.set_category_exempt("spaceships", True)


def test_tax_api_routes(tax):
    app = Flask(__name__)
    init_tax_routes(app, tax)
    c = app.test_client()
    r = c.put("/api/items/1001/tax-exempt", json={"tax_exempt": True})
    assert r.status_code == 200
    r = c.put("/api/categories/drinks/tax-exempt", json={"tax_exempt": True})
    assert r.status_code == 404
    r = c.put("/api/categories/exam supplies/tax-exempt", json={"tax_exempt": True})
    assert r.status_code == 200
    assert c.put("/api/items/1001/tax-exempt", json={"tax_exempt": "yes"}).status_code == 400
    data = c.get("/api/tax-exemptions").get_json()["data"]
    assert data == {"categories": ["exam supplies"], "items": [1001]}
