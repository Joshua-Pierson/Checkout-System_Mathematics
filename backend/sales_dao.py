"""Sales and inventory-level database code.

Covers three Sprint 2 stories:
  * As a system, I can save a record of every completed sale
  * As a system, I can subtract items from inventory when a sale is paid for
  * As a manager, I can see current inventory levels

Saving a sale and subtracting stock happen in ONE database transaction,
so either both happen or neither does (no half-finished sales).
"""
from decimal import Decimal, ROUND_HALF_UP

from card_payment import CardDeclined, authorize_card
from tax_dao import EFFECTIVE_TAX_RATE_SQL

CENT = Decimal("0.01")
LOW_STOCK_DEFAULT = 5


class SaleError(Exception):
    """A sale was rejected (bad input, unknown item, not enough stock...)."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def _money(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


class SalesDAO:
    def __init__(self, inventory_dao):
        # InventoryModel from mysql_dao.py (Giorgiana's DAO) gives us connections.
        self.inventory_dao = inventory_dao

    # ---------- save sale + subtract inventory ----------
    def record_sale(self, items, payment_method, cash_received=None, card_number=None):
        """Save a paid sale and subtract its items from stock.

        items: list of {"item_id": 1001, "quantity": 2}  (item_id may also be "1001")
        payment_method: "cash" or "card"
        cash_received: required for cash; must cover the total.
        card_number: required for card; checked by card_payment.authorize_card.
        Prices and tax always come from the database, never from the browser.
        """
        cart = self._merge_cart(items)
        if payment_method not in ("cash", "card"):
            raise SaleError("payment_method must be 'cash' or 'card'")

        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            conn.start_transaction()

            # Lock these item rows so two checkouts can't sell the same last item.
            ids = sorted(cart)
            placeholders = ", ".join(["%s"] * len(ids))
            cursor.execute(
                f"SELECT i.item_id, i.name, i.unit_price, i.stock_quantity, "
                f"{EFFECTIVE_TAX_RATE_SQL} AS tax_rate "
                f"FROM inventory i "
                f"LEFT JOIN tax_exempt_categories tec ON tec.category = i.category "
                f"WHERE i.item_id IN ({placeholders}) "
                f"ORDER BY i.item_id FOR UPDATE",
                ids,
            )
            rows = {row["item_id"]: row for row in cursor.fetchall()}

            missing = [i for i in ids if i not in rows]
            if missing:
                raise SaleError(f"Unknown item code(s): {', '.join(map(str, missing))}", 404)

            lines, subtotal, tax = [], Decimal("0"), Decimal("0")
            for item_id in ids:
                row, qty = rows[item_id], cart[item_id]
                if row["stock_quantity"] < qty:
                    raise SaleError(
                        f"Not enough stock for {row['name']} "
                        f"(have {row['stock_quantity']}, need {qty})", 409)
                price = Decimal(row["unit_price"])
                rate = Decimal(row["tax_rate"])
                line_total = _money(price * qty)
                subtotal += line_total
                tax += line_total * rate
                lines.append({
                    "item_id": item_id, "name": row["name"], "unit_price": price,
                    "quantity": qty, "tax_rate": rate, "line_total": line_total,
                })

            subtotal, tax = _money(subtotal), _money(tax)
            total = subtotal + tax

            if payment_method == "cash":
                if cash_received is None:
                    raise SaleError("cash_received is required for cash payments")
                try:
                    paid = _money(cash_received)
                except Exception:
                    raise SaleError("cash_received must be a number")
                if paid < total:
                    raise SaleError(f"Not enough cash: total is {total}, received {paid}")
            card_last4 = None
            if payment_method == "card":
                try:
                    card_last4 = authorize_card(card_number)
                except ValueError as err:
                    raise SaleError(str(err))
                except CardDeclined as err:
                    raise SaleError(str(err), 402)
                paid = total  # card is charged the exact total
            change = paid - total

            cursor.execute(
                "INSERT INTO sales (payment_method, subtotal, tax, total, amount_paid, change_due, card_last4) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (payment_method, subtotal, tax, total, paid, change, card_last4),
            )
            sale_id = cursor.lastrowid

            for line in lines:
                cursor.execute(
                    "INSERT INTO sale_items (sale_id, item_id, name, unit_price, quantity, tax_rate, line_total) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (sale_id, line["item_id"], line["name"], line["unit_price"],
                     line["quantity"], line["tax_rate"], line["line_total"]),
                )
                cursor.execute(
                    "UPDATE inventory SET stock_quantity = stock_quantity - %s WHERE item_id = %s",
                    (line["quantity"], line["item_id"]),
                )

            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return self.get_sale(sale_id)

    def get_sale(self, sale_id):
        """Return one saved sale with its item lines, or None."""
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT * FROM sales WHERE sale_id = %s", (sale_id,))
            sale = cursor.fetchone()
            if sale is None:
                return None
            cursor.execute(
                "SELECT item_id, name, unit_price, quantity, tax_rate, line_total "
                "FROM sale_items WHERE sale_id = %s ORDER BY sale_item_id", (sale_id,))
            sale["items"] = cursor.fetchall()
            return _to_json(sale)
        finally:
            cursor.close()
            conn.close()

    # ---------- inventory levels (manager) ----------
    def get_inventory_levels(self, category=None, low_stock_only=False,
                             low_stock_threshold=LOW_STOCK_DEFAULT):
        """List items with stock and a low-stock flag, sorted lowest stock first."""
        query = ("SELECT item_id, name, category, unit_price, stock_quantity "
                 "FROM inventory")
        conditions, params = [], []
        if category:
            conditions.append("category = %s")
            params.append(category)
        if low_stock_only:
            conditions.append("stock_quantity <= %s")
            params.append(low_stock_threshold)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY stock_quantity ASC, name ASC"

        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute(query, params)
            items = cursor.fetchall()
        finally:
            cursor.close()
            conn.close()

        for item in items:
            item["low_stock"] = item["stock_quantity"] <= low_stock_threshold
        return _to_json(items)

    # ---------- helpers ----------
    @staticmethod
    def _merge_cart(items):
        """Validate the cart and combine duplicate item codes."""
        if not isinstance(items, list) or not items:
            raise SaleError("items must be a non-empty list")
        cart = {}
        for entry in items:
            if not isinstance(entry, dict) or "item_id" not in entry:
                raise SaleError("each item needs an item_id")
            qty = entry.get("quantity", 1)
            if not isinstance(qty, int) or isinstance(qty, bool) or qty < 1:
                raise SaleError("quantity must be a whole number of at least 1")
            item_id = _to_item_id(entry["item_id"])
            if item_id is None:
                raise SaleError("item_id must be a whole number, e.g. 1001")
            cart[item_id] = cart.get(item_id, 0) + qty
        return cart


def _to_item_id(value):
    """Item codes are numbers in the inventory table. Accept 1001 or "1001"."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    text = str(value).strip()
    return int(text) if text.isdigit() else None


def _to_json(value):
    """Turn Decimals/dates into plain JSON-friendly values."""
    if isinstance(value, list):
        return [_to_json(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_json(v) for k, v in value.items()}
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value
