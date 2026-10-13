"""Tax-exempt settings for the story
"As a manager, I can mark a category or item as tax-exempt".

An item is NOT taxed when either:
  * the item itself is marked tax_exempt, or
  * its category is in tax_exempt_categories.
Checkout (sales_dao.py) uses the same rule via EFFECTIVE_TAX_RATE_SQL.
"""

# SQL snippet used by checkout. Needs inventory_records aliased as "i" and
#   LEFT JOIN tax_exempt_categories tec ON tec.category = i.category
EFFECTIVE_TAX_RATE_SQL = (
    "CASE WHEN i.tax_exempt OR tec.category IS NOT NULL THEN 0 ELSE i.tax_rate END"
)


class NotFound(Exception):
    pass


class TaxDAO:
    def __init__(self, inventory_dao):
        self.inventory_dao = inventory_dao

    def set_item_exempt(self, item_id, exempt):
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT 1 FROM inventory_records WHERE item_id = %s", (item_id,))
            if cursor.fetchone() is None:
                raise NotFound(f"Unknown item code: {item_id}")
            cursor.execute("UPDATE inventory_records SET tax_exempt = %s WHERE item_id = %s",
                           (bool(exempt), item_id))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def set_category_exempt(self, category, exempt):
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT 1 FROM inventory_records WHERE category = %s LIMIT 1", (category,))
            if cursor.fetchone() is None:
                raise NotFound(f"Unknown category: {category}")
            if exempt:
                cursor.execute("INSERT IGNORE INTO tax_exempt_categories (category) VALUES (%s)",
                               (category,))
            else:
                cursor.execute("DELETE FROM tax_exempt_categories WHERE category = %s", (category,))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def list_exemptions(self):
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT category FROM tax_exempt_categories ORDER BY category")
            categories = [row[0] for row in cursor.fetchall()]
            cursor.execute("SELECT item_id FROM inventory_records WHERE tax_exempt ORDER BY item_id")
            items = [row[0] for row in cursor.fetchall()]
        finally:
            cursor.close()
            conn.close()
        return {"categories": categories, "items": items}
