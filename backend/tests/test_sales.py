"""Tests for sales + inventory levels. Needs a running MySQL on port 3307.

Run from the repo root:
    DB_PASSWORD=yourpassword python -m pytest backend/tests -v
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DB_NAME", "checkout_system")

mysql = pytest.importorskip("mysql.connector")
from flask import Flask  # noqa: E402

from mysql_dao import MySQLInventoryDAO  # noqa: E402
from sales_dao import SalesDAO, SaleError  # noqa: E402
from sales_routes import init_sales_routes  # noqa: E402

SEED = [
    ("1001", "Introduction to Algorithms", "books", "85.00", 40, "0.0000"),
    ("1002", "Graphing Calculator TI-84", "course supplies", "115.00", 25, "0.0825"),
    ("1003", "Blue Scantrons 5-Pack", "exam supplies", "3.50", 3, "0.0825"),
]


@pytest.fixture()
def dao():
    try:
        inventory_dao = MySQLInventoryDAO()
    except mysql.Error as err:
        pytest.skip(f"MySQL not available: {err}")
    conn = inventory_dao.get_connection()
    cur = conn.cursor()
    for stmt in [
        "DROP TABLE IF EXISTS sale_items", "DROP TABLE IF EXISTS sales",
        "DROP TABLE IF EXISTS inventory_records",
        """CREATE TABLE inventory_records (
            item_id VARCHAR(50) PRIMARY KEY, name VARCHAR(100) NOT NULL,
            category VARCHAR(50) NOT NULL, price DECIMAL(10,2) NOT NULL,
            stock_quantity INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
    ]:
        cur.execute(stmt)
    schema = open(os.path.join(os.path.dirname(__file__), "..", "sales_schema.sql")).read()
    for stmt in [s.strip() for s in schema.split(";")]:
        lines = [ln for ln in stmt.splitlines() if not ln.strip().startswith("--")]
        if "\n".join(lines).strip():
            cur.execute("\n".join(lines))
    cur.executemany(
        "INSERT INTO inventory_records (item_id, name, category, price, stock_quantity, tax_rate) "
        "VALUES (%s, %s, %s, %s, %s, %s)", SEED)
    conn.commit()
    cur.close()
    conn.close()
    return SalesDAO(inventory_dao)


def stock(dao, item_id):
    return {i["item_id"]: i["stock_quantity"] for i in dao.get_inventory_levels()}[item_id]


def test_card_sale_saves_record_and_subtracts_stock(dao):
    sale = dao.record_sale([{"item_id": "1002", "quantity": 2}], "card")
    assert sale["subtotal"] == 230.00
    assert sale["tax"] == 18.98          # 230 * 0.0825 = 18.975 -> 18.98
    assert sale["total"] == 248.98
    assert sale["items"][0]["quantity"] == 2
    assert stock(dao, "1002") == 23


def test_cash_sale_gives_change_and_tax_exempt_item(dao):
    sale = dao.record_sale(
        [{"item_id": "1001", "quantity": 1}, {"item_id": "1003", "quantity": 2}],
        "cash", cash_received=100)
    assert sale["subtotal"] == 92.00     # 85 + 7
    assert sale["tax"] == 0.58           # only scantrons taxed: 7 * 0.0825
    assert sale["total"] == 92.58
    assert sale["change_due"] == 7.42
    assert dao.get_sale(sale["sale_id"])["total"] == 92.58


def test_duplicate_lines_are_combined(dao):
    sale = dao.record_sale([{"item_id": "1003", "quantity": 1},
                            {"item_id": "1003", "quantity": 1}], "card")
    assert len(sale["items"]) == 1 and sale["items"][0]["quantity"] == 2
    assert stock(dao, "1003") == 1


@pytest.mark.parametrize("items,method,cash,status", [
    ([{"item_id": "1003", "quantity": 4}], "card", None, 409),   # not enough stock
    ([{"item_id": "9999", "quantity": 1}], "card", None, 404),   # unknown item
    ([{"item_id": "1001", "quantity": 1}], "cash", 10, 400),     # not enough cash
    ([{"item_id": "1001", "quantity": 0}], "card", None, 400),   # bad quantity
    ([], "card", None, 400),                                     # empty cart
    ([{"item_id": "1001"}], "bitcoin", None, 400),               # bad payment method
])
def test_rejected_sales_change_nothing(dao, items, method, cash, status):
    with pytest.raises(SaleError) as err:
        dao.record_sale(items, method, cash_received=cash)
    assert err.value.status == status
    assert stock(dao, "1001") == 40 and stock(dao, "1003") == 3


def test_failed_line_rolls_back_whole_sale(dao):
    # 1001 is fine but 1003 is short -> nothing should be subtracted or saved.
    with pytest.raises(SaleError):
        dao.record_sale([{"item_id": "1001", "quantity": 1},
                         {"item_id": "1003", "quantity": 10}], "card")
    assert stock(dao, "1001") == 40
    assert dao.get_sale(1) is None


def test_inventory_levels_filters(dao):
    low = dao.get_inventory_levels(low_stock_only=True)
    assert [i["item_id"] for i in low] == ["1003"] and low[0]["low_stock"] is True
    books = dao.get_inventory_levels(category="books")
    assert [i["item_id"] for i in books] == ["1001"]


def test_api_routes(dao):
    app = Flask(__name__)
    init_sales_routes(app, dao)
    client = app.test_client()

    r = client.post("/api/sales", json={"items": [{"item_id": "1001", "quantity": 1}],
                                         "payment_method": "card"})
    assert r.status_code == 201
    sale_id = r.get_json()["data"]["sale_id"]
    assert client.get(f"/api/sales/{sale_id}").status_code == 200
    assert client.get("/api/sales/9999").status_code == 404

    r = client.post("/api/sales", json={"items": [{"item_id": "1003", "quantity": 99}],
                                         "payment_method": "card"})
    assert r.status_code == 409 and "Not enough stock" in r.get_json()["message"]

    r = client.get("/api/inventory/levels?low_stock=true")
    assert [i["item_id"] for i in r.get_json()["data"]] == ["1003"]
    assert client.get("/api/inventory/levels?threshold=abc").status_code == 400
