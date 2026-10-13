"""Tests for search, browse categories, and category grouping."""
import pytest
from flask import Flask

from catalog_dao import CatalogDAO, normalize_category
from catalog_routes import init_catalog_routes
from tax_dao import TaxDAO

EXTRA = [  # messy categories on purpose, like the real items.csv ("BOOKS!")
    ("1004", "Energy Drink", "Drinks!", "2.99", 50),
    ("1005", "Calculus Workbook", "BOOKS!", "40.00", 0),
    ("1006", "100% Cotton Hoodie", "  Apparel ", "35.00", 8),
]


@pytest.fixture()
def catalog(inventory_dao):
    conn = inventory_dao.get_connection()
    cur = conn.cursor()
    cur.executemany("INSERT INTO inventory_records (item_id, name, category, price, stock_quantity) "
                    "VALUES (%s, %s, %s, %s, %s)", EXTRA)
    conn.commit()
    cur.close()
    conn.close()
    return CatalogDAO(inventory_dao)


def ids(items):
    return [i["item_id"] for i in items]


# ---------- normalize ----------
@pytest.mark.parametrize("raw,clean", [
    ("BOOKS!", "books"), ("  Art   Supplies ", "art supplies"),
    ("Course-Supplies", "course supplies"), ("snacks", "snacks"),
    ("!!!", ""), (None, ""),
])
def test_normalize_category(raw, clean):
    assert normalize_category(raw) == clean


# ---------- search ----------
def test_search_is_case_insensitive(catalog):
    assert ids(catalog.search_items("CALC")) == ["1005", "1002"]   # "Calculus..." starts with it
    assert ids(catalog.search_items("calculator")) == ["1002"]


def test_search_by_exact_code_comes_first(catalog):
    assert ids(catalog.search_items("1003"))[0] == "1003"


def test_search_wildcards_are_literal(catalog):
    assert ids(catalog.search_items("100%")) == ["1006"]   # not "match everything"
    assert catalog.search_items("_") == []


def test_search_shows_stock(catalog):
    item = catalog.search_items("workbook")[0]
    assert item["in_stock"] is False and item["unit_price"] == 40.0


def test_search_needs_text(catalog):
    with pytest.raises(ValueError):
        catalog.search_items("   ")


# ---------- browse ----------
def test_browse_after_normalize(catalog):
    changes = catalog.normalize_all_categories()
    assert changes == {"Drinks!": "drinks", "BOOKS!": "books", "  Apparel ": "apparel"}
    cats = {c["category"]: c for c in catalog.list_categories()}
    assert cats["books"]["item_count"] == 2 and cats["books"]["in_stock_count"] == 1
    assert ids(catalog.items_in_category("Books!")) == ["1005", "1001"]   # messy input OK
    assert catalog.items_in_category("spaceships") == []
    grouped = catalog.grouped_catalog()
    assert list(grouped) == sorted(grouped) and ids(grouped["drinks"]) == ["1004"]
    assert catalog.normalize_all_categories() == {}    # running twice changes nothing


def test_normalize_keeps_tax_exempt_setting(catalog, inventory_dao):
    TaxDAO(inventory_dao).set_category_exempt("BOOKS!", True)
    catalog.normalize_all_categories()
    assert TaxDAO(inventory_dao).list_exemptions()["categories"] == ["books"]


# ---------- API ----------
def test_catalog_api(catalog):
    app = Flask(__name__)
    init_catalog_routes(app, catalog)
    c = app.test_client()
    assert c.get("/api/items/search?q=drink").get_json()["data"][0]["item_id"] == "1004"
    assert c.get("/api/items/search?q=").status_code == 400
    assert c.get("/api/items/search?q=" + "x" * 101).status_code == 400
    r = c.post("/api/categories/normalize")
    assert r.status_code == 200 and r.get_json()["data"]["renamed"]["BOOKS!"] == "books"
    assert c.get("/api/categories").status_code == 200
    assert c.get("/api/categories/drinks/items").status_code == 200
    assert c.get("/api/categories/spaceships/items").status_code == 404
    assert "books" in c.get("/api/catalog/grouped").get_json()["data"]
