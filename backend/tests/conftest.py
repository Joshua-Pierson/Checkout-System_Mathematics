"""Shared test setup: builds a fresh test database before each test.

Needs MySQL on port 3307. Run from the repo root:
    DB_PASSWORD=yourpassword python -m pytest backend/tests -v
"""
import os
import sys

import pytest

BACKEND = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, BACKEND)
os.environ.setdefault("DB_NAME", "checkout_system")

mysql = pytest.importorskip("mysql.connector")
from mysql_dao import MySQLInventoryDAO  # noqa: E402
from sales_dao import SalesDAO  # noqa: E402

SEED = [
    ("1001", "Introduction to Algorithms", "books", "85.00", 40, "0.0000"),
    ("1002", "Graphing Calculator TI-84", "course supplies", "115.00", 25, "0.0825"),
    ("1003", "Blue Scantrons 5-Pack", "exam supplies", "3.50", 3, "0.0825"),
]
SCHEMA_FILES = ["sales_schema.sql", "tax_card_schema.sql"]


def _run_sql_file(cur, name):
    text = open(os.path.join(BACKEND, name)).read()
    for stmt in text.split(";"):
        lines = [ln for ln in stmt.splitlines() if not ln.strip().startswith("--")]
        sql = "\n".join(lines).strip()
        if sql:
            cur.execute(sql)


@pytest.fixture()
def inventory_dao():
    try:
        inv = MySQLInventoryDAO()
    except mysql.Error as err:
        pytest.skip(f"MySQL not available: {err}")
    conn = inv.get_connection()
    cur = conn.cursor()
    for stmt in [
        "DROP TABLE IF EXISTS sale_items", "DROP TABLE IF EXISTS sales",
        "DROP TABLE IF EXISTS tax_exempt_categories",
        "DROP TABLE IF EXISTS inventory_records",
        """CREATE TABLE inventory_records (
            item_id VARCHAR(50) PRIMARY KEY, name VARCHAR(100) NOT NULL,
            category VARCHAR(50) NOT NULL, price DECIMAL(10,2) NOT NULL,
            stock_quantity INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
    ]:
        cur.execute(stmt)
    for name in SCHEMA_FILES:
        _run_sql_file(cur, name)
    cur.executemany(
        "INSERT INTO inventory_records (item_id, name, category, price, stock_quantity, tax_rate) "
        "VALUES (%s, %s, %s, %s, %s, %s)", SEED)
    conn.commit()
    cur.close()
    conn.close()
    return inv


@pytest.fixture()
def dao(inventory_dao):
    return SalesDAO(inventory_dao)
