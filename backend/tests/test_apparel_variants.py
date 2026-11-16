"""Apparel size/color tracking: each size + color has its own stock."""
import pytest

from main import app


@pytest.fixture()
def hoodie(inventory_dao):
    """A hoodie (item 2001) with two navy sizes: M has 5, L has 1."""
    conn = inventory_dao.get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO inventory (item_id, name, category, unit_price, stock_quantity, tax_rate) "
        "VALUES (2001, 'University Hoodie', 'apparel', 45.00, 6, 0.0)")
    cur.execute("INSERT INTO apparel_variants (variant_id, item_id, size, color, stock_quantity) "
                "VALUES (1, 2001, 'M', 'Navy', 5), (2, 2001, 'L', 'Navy', 1)")
    conn.commit()
    cur.close()
    conn.close()
    return inventory_dao


def _stock(dao, sql, arg):
    conn = dao.get_connection()
    cur = conn.cursor()
    cur.execute(sql, (arg,))
    value = cur.fetchone()[0]
    cur.close()
    conn.close()
    return value


def test_lists_sizes_and_colors(hoodie):
    res = app.test_client().get("/api/items/2001/variants")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert [(v["color"], v["size"], v["stock_quantity"]) for v in data] == [
        ("Navy", "M", 5), ("Navy", "L", 1)]


def test_unknown_item_returns_404(hoodie):
    assert app.test_client().get("/api/items/9999/variants").status_code == 404


def test_selling_one_size_leaves_other_sizes_alone(hoodie):
    res = app.test_client().post("/api/checkout/cash", json={
        "cart": [{"item_id": 2001, "variant_id": 1, "quantity": 2}],
        "cash_tendered": 200})
    assert res.status_code == 200, res.get_json()
    assert _stock(hoodie, "SELECT stock_quantity FROM apparel_variants WHERE variant_id=%s", 1) == 3
    assert _stock(hoodie, "SELECT stock_quantity FROM apparel_variants WHERE variant_id=%s", 2) == 1
    assert _stock(hoodie, "SELECT stock_quantity FROM inventory WHERE item_id=%s", 2001) == 4


def test_sold_out_size_is_blocked(hoodie):
    res = app.test_client().post("/api/checkout/cash", json={
        "cart": [{"item_id": 2001, "variant_id": 2, "quantity": 2}],
        "cash_tendered": 200})
    assert res.status_code == 409
    assert "Only 1 left" in res.get_json()["message"]
    assert _stock(hoodie, "SELECT stock_quantity FROM apparel_variants WHERE variant_id=%s", 2) == 1


def test_variant_from_another_item_is_rejected(hoodie):
    res = app.test_client().post("/api/checkout/cash", json={
        "cart": [{"item_id": 1001, "variant_id": 1, "quantity": 1}],
        "cash_tendered": 200})
    assert res.status_code == 404
