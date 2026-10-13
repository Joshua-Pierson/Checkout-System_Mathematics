"""Tests for sales + inventory levels. Needs a running MySQL (see conftest.py).

Run from the repo root:
    python -m pytest backend/tests -v
"""
import pytest

pytest.importorskip("mysql.connector")
from flask import Flask  # noqa: E402

from sales_dao import SaleError  # noqa: E402
from sales_routes import init_sales_routes  # noqa: E402

CARD = "4242 4242 4242 4242"  # approved test card


def stock(dao, item_id):
    return {i["item_id"]: i["stock_quantity"] for i in dao.get_inventory_levels()}[item_id]


def test_card_sale_saves_record_and_subtracts_stock(dao):
    sale = dao.record_sale([{"item_id": 1002, "quantity": 2}], "card", card_number=CARD)
    assert sale["subtotal"] == 230.00
    assert sale["tax"] == 18.98          # 230 * 0.0825 = 18.975 -> 18.98
    assert sale["total"] == 248.98
    assert sale["items"][0]["quantity"] == 2
    assert stock(dao, 1002) == 23


def test_cash_sale_gives_change_and_tax_exempt_item(dao):
    sale = dao.record_sale(
        [{"item_id": 1001, "quantity": 1}, {"item_id": 1003, "quantity": 2}],
        "cash", cash_received=100)
    assert sale["subtotal"] == 92.00     # 85 + 7
    assert sale["tax"] == 0.58           # only scantrons taxed: 7 * 0.0825
    assert sale["total"] == 92.58
    assert sale["change_due"] == 7.42
    assert dao.get_sale(sale["sale_id"])["total"] == 92.58


def test_duplicate_lines_are_combined(dao):
    sale = dao.record_sale([{"item_id": 1003, "quantity": 1},
                            {"item_id": 1003, "quantity": 1}], "card", card_number=CARD)
    assert len(sale["items"]) == 1 and sale["items"][0]["quantity"] == 2
    assert stock(dao, 1003) == 1


@pytest.mark.parametrize("items,method,cash,status", [
    ([{"item_id": 1003, "quantity": 4}], "card", None, 409),   # not enough stock
    ([{"item_id": 9999, "quantity": 1}], "card", None, 404),   # unknown item
    ([{"item_id": 1001, "quantity": 1}], "cash", 10, 400),     # not enough cash
    ([{"item_id": 1001, "quantity": 0}], "card", None, 400),   # bad quantity
    ([], "card", None, 400),                                     # empty cart
    ([{"item_id": 1001}], "bitcoin", None, 400),               # bad payment method
])
def test_rejected_sales_change_nothing(dao, items, method, cash, status):
    with pytest.raises(SaleError) as err:
        dao.record_sale(items, method, cash_received=cash, card_number=CARD)
    assert err.value.status == status
    assert stock(dao, 1001) == 40 and stock(dao, 1003) == 3


def test_failed_line_rolls_back_whole_sale(dao):
    # 1001 is fine but 1003 is short -> nothing should be subtracted or saved.
    with pytest.raises(SaleError):
        dao.record_sale([{"item_id": 1001, "quantity": 1},
                         {"item_id": 1003, "quantity": 10}], "card", card_number=CARD)
    assert stock(dao, 1001) == 40
    assert dao.get_sale(1) is None


def test_inventory_levels_filters(dao):
    low = dao.get_inventory_levels(low_stock_only=True)
    assert [i["item_id"] for i in low] == [1003] and low[0]["low_stock"] is True
    books = dao.get_inventory_levels(category="books")
    assert [i["item_id"] for i in books] == [1001]


def test_api_routes(dao):
    app = Flask(__name__)
    init_sales_routes(app, dao)
    client = app.test_client()

    r = client.post("/api/sales", json={"items": [{"item_id": 1001, "quantity": 1}],
                                         "payment_method": "card", "card_number": CARD})
    assert r.status_code == 201
    sale_id = r.get_json()["data"]["sale_id"]
    assert client.get(f"/api/sales/{sale_id}").status_code == 200
    assert client.get("/api/sales/9999").status_code == 404

    r = client.post("/api/sales", json={"items": [{"item_id": 1003, "quantity": 99}],
                                         "payment_method": "card", "card_number": CARD})
    assert r.status_code == 409 and "Not enough stock" in r.get_json()["message"]

    r = client.get("/api/inventory/levels?low_stock=true")
    assert [i["item_id"] for i in r.get_json()["data"]] == [1003]
    assert client.get("/api/inventory/levels?threshold=abc").status_code == 400
