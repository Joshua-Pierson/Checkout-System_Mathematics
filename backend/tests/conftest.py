"""Shared test setup: builds a fresh test database before each test.

Needs MySQL on 127.0.0.1:3306 (e.g. the Docker db container). Run from the repo root:
    python -m pytest backend/tests -v
Uses its own database (checkout_test) so your real pos_inventory data is safe:
    CREATE DATABASE checkout_test;
"""
import os
import sys

import pytest

BACKEND = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, BACKEND)
os.environ.setdefault("DB_HOST", "127.0.0.1")
os.environ["DB_NAME"] = os.environ.get("TEST_DB_NAME", "checkout_test")

mysql = pytest.importorskip("mysql.connector")
from mysql_dao import InventoryModel  # noqa: E402
from sales_dao import SalesDAO  # noqa: E402

SEED = [
    (1001, "Introduction to Algorithms", "books", "85.00", 40, "0.0000"),
    (1002, "Graphing Calculator TI-84", "course supplies", "115.00", 25, "0.0825"),
    (1003, "Blue Scantrons 5-Pack", "exam supplies", "3.50", 3, "0.0825"),
]


def _run_init_sql(cur):
    """Create the same tables Docker makes, but in the test database."""
    text = open(os.path.join(BACKEND, "init.sql")).read()
    for stmt in text.split(";"):
        lines = [ln for ln in stmt.splitlines() if not ln.strip().startswith("--")]
        sql = "\n".join(lines).strip()
        if sql and not sql.upper().startswith(("CREATE DATABASE", "USE ")):
            cur.execute(sql)


@pytest.fixture()
def inventory_dao():
    inv = InventoryModel()
    try:
        conn = inv.get_connection()
    except mysql.Error as err:
        pytest.skip(f"MySQL not available: {err}")
    cur = conn.cursor()
    for table in ["sale_items", "sales", "tax_exempt_categories", "inventory"]:
        cur.execute(f"DROP TABLE IF EXISTS {table}")
    _run_init_sql(cur)
    cur.executemany(
        "INSERT INTO inventory (item_id, name, category, unit_price, stock_quantity, tax_rate) "
        "VALUES (%s, %s, %s, %s, %s, %s)", SEED)
    conn.commit()
    cur.close()
    conn.close()
    return inv


@pytest.fixture()
def dao(inventory_dao):
    return SalesDAO(inventory_dao)
