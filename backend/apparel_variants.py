"""Apparel size/color tracking (Sprint 3 - Hien).

Story: "As a system, I can track apparel by size and color."
Each size + color combination has its own stock, so a medium navy hoodie
and a large navy hoodie are counted separately.

A cart line may include "variant_id". When it does, checkout checks and
lowers that variant's stock as well as the item's total stock.
"""

# Set to True once the frontend size/color picker (Andre's task) ships:
# then apparel that has variants cannot be sold without choosing one.
REQUIRE_VARIANT_FOR_APPAREL = False


def _variant_json(row):
    return {
        "variant_id": row["variant_id"],
        "item_id": row["item_id"],
        "size": row["size"],
        "color": row["color"],
        "stock_quantity": int(row["stock_quantity"]),
    }


def list_variants(cursor, item_id):
    """All size/color combinations for one item, smallest size first."""
    cursor.execute(
        "SELECT variant_id, item_id, size, color, stock_quantity "
        "FROM apparel_variants WHERE item_id = %s "
        "ORDER BY color, FIELD(size, 'XS','S','M','L','XL','XXL'), size",
        (item_id,),
    )
    return [_variant_json(r) for r in cursor.fetchall()]


def check_variant(cursor, item_id, variant_id, quantity):
    """Validate a cart line's variant.

    Returns (variant_dict_or_None, error_message_or_None, http_status).
    """
    if variant_id is None:
        if REQUIRE_VARIANT_FOR_APPAREL:
            cursor.execute("SELECT COUNT(*) AS n FROM apparel_variants WHERE item_id = %s", (item_id,))
            if cursor.fetchone()["n"] > 0:
                return None, f"Choose a size and color for item {item_id}.", 400
        return None, None, 200

    cursor.execute(
        "SELECT variant_id, item_id, size, color, stock_quantity "
        "FROM apparel_variants WHERE variant_id = %s",
        (variant_id,),
    )
    row = cursor.fetchone()
    if not row or int(row["item_id"]) != int(item_id):
        return None, f"Variant {variant_id} not found for item {item_id}.", 404
    if int(row["stock_quantity"]) < int(quantity):
        return None, f"Only {row['stock_quantity']} left in {row['color']}, size {row['size']}.", 409
    return _variant_json(row), None, 200


def decrement_variant(conn, variant_id, quantity):
    """Atomically lower one variant's stock; fails if not enough left."""
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE apparel_variants SET stock_quantity = stock_quantity - %s "
            "WHERE variant_id = %s AND stock_quantity >= %s",
            (quantity, variant_id, quantity),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise ValueError(f"Insufficient stock for variant {variant_id}.")
    finally:
        cur.close()
