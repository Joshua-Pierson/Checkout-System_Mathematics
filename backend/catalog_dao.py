"""Catalog lookups for three Sprint 2 stories:
  * As a student, I can search for an item by name
  * As a student, I can browse categories to find an item without a code
  * As a manager, I can group items into categories (clean, consistent names)
"""
import re
from decimal import Decimal

SEARCH_LIMIT = 50


def normalize_category(name):
    """Turn messy category text into one clean name.

    "BOOKS!" -> "books", "  Art   Supplies " -> "art supplies",
    "Course-Supplies" -> "course supplies". Returns "" if nothing is left.
    """
    if not isinstance(name, str):
        return ""
    text = name.strip().lower().replace("-", " ").replace("_", " ")
    text = re.sub(r"[^a-z0-9& ]", "", text)     # drop punctuation like "!"
    return re.sub(r"\s+", " ", text).strip()     # collapse extra spaces


def _item_json(row):
    item = {
        "item_id": row["item_id"],
        "name": row["name"],
        "category": row["category"],
        "unit_price": float(Decimal(row["price"])),
        "stock_quantity": row["stock_quantity"],
    }
    item["in_stock"] = item["stock_quantity"] > 0
    return item


class CatalogDAO:
    def __init__(self, inventory_dao):
        self.inventory_dao = inventory_dao

    def _query(self, sql, params=()):
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute(sql, params)
            return cursor.fetchall()
        finally:
            cursor.close()
            conn.close()

    # ---------- search ----------
    def search_items(self, text, limit=SEARCH_LIMIT):
        """Case-insensitive name search. An exact item code also matches.

        Results: exact code first, then names starting with the text, then
        names containing it; alphabetical inside each group.
        """
        text = (text or "").strip()
        if not text:
            raise ValueError("search text is required")
        # Escape LIKE wildcards so "%" or "_" typed by a user are literal.
        safe = text.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        rows = self._query(
            "SELECT item_id, name, category, price, stock_quantity FROM inventory_records "
            "WHERE LOWER(name) LIKE %s OR item_id = %s "
            "ORDER BY CASE WHEN item_id = %s THEN 0 "
            "              WHEN LOWER(name) LIKE %s THEN 1 ELSE 2 END, name "
            "LIMIT %s",
            (f"%{safe}%", text, text, f"{safe}%", int(limit)),
        )
        return [_item_json(r) for r in rows]

    # ---------- browse ----------
    def list_categories(self):
        """Every category with how many items it has, A-Z."""
        rows = self._query(
            "SELECT category, COUNT(*) AS item_count, "
            "SUM(stock_quantity > 0) AS in_stock_count "
            "FROM inventory_records GROUP BY category ORDER BY category")
        return [{"category": r["category"], "item_count": int(r["item_count"]),
                 "in_stock_count": int(r["in_stock_count"] or 0)} for r in rows]

    def items_in_category(self, category):
        """Items in one category, A-Z. Accepts messy input like 'Books!'."""
        clean = normalize_category(category)
        rows = self._query(
            "SELECT item_id, name, category, price, stock_quantity FROM inventory_records "
            "WHERE category = %s ORDER BY name", (clean,))
        return [_item_json(r) for r in rows]

    def grouped_catalog(self):
        """Whole catalog grouped by category: {"books": [...], "drinks": [...]}."""
        rows = self._query(
            "SELECT item_id, name, category, price, stock_quantity FROM inventory_records "
            "ORDER BY category, name")
        groups = {}
        for r in rows:
            groups.setdefault(r["category"], []).append(_item_json(r))
        return groups

    # ---------- grouping cleanup (manager) ----------
    def normalize_all_categories(self):
        """Rewrite every category in the database to its clean name.

        Also updates tax_exempt_categories so tax-exempt settings follow the
        rename. Returns {"old name": "new name"} for whatever changed.
        """
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor()
        changes = {}
        try:
            conn.start_transaction()
            cursor.execute("SELECT DISTINCT category FROM inventory_records")
            for (old,) in cursor.fetchall():
                new = normalize_category(old) or "uncategorized"
                if new != old:
                    changes[old] = new
                    cursor.execute("UPDATE inventory_records SET category = %s WHERE category = %s",
                                   (new, old))
            cursor.execute("SELECT category FROM tax_exempt_categories")
            for (old,) in cursor.fetchall():
                new = normalize_category(old) or "uncategorized"
                if new != old:
                    cursor.execute("DELETE FROM tax_exempt_categories WHERE category = %s", (old,))
                    cursor.execute("INSERT IGNORE INTO tax_exempt_categories (category) VALUES (%s)",
                                   (new,))
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
        return changes
