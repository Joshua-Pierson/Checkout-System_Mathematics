class CourseDAO:
    def __init__(self, inventory_dao):
        self.inventory_dao = inventory_dao

    def get_course_bundle(self, course_code):
        """Fetch required items and their current stock."""
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("""
                SELECT cb.item_id,
                       cb.quantity AS required_quantity,
                       i.name,
                       i.unit_price,
                       i.category,
                       i.tax_rate,
                       i.stock_quantity
                FROM course_bundles cb
                JOIN inventory i ON cb.item_id = i.item_id
                WHERE cb.course_code = %s
            """, (course_code.strip().upper(),))
            return cursor.fetchall()
        finally:
            cursor.close()
            conn.close()
            
    def create_course_bundle(self, name, items):
        """Save a named list without changing or reserving stock."""
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Enter a bundle name.")
        course_code = name.strip().upper()
        if len(course_code) > 50:
            raise ValueError("Bundle name must be 50 characters or fewer.")
        if not isinstance(items, list) or not items:
            raise ValueError("Add at least one catalog item.")
        rows = []
        item_ids = set()

        for item in items:
            if not isinstance(item, dict):
                raise ValueError("Invalid bundle item.")
            item_id = item.get("item_id")
            quantity = item.get("quantity")
            if type(item_id) is not int or item_id < 1:
                raise ValueError("Each item needs a valid item ID.")
            if type(quantity) is not int or quantity < 1:
                raise ValueError("Quantities must be positive whole numbers.")
            if item_id in item_ids:
                raise ValueError(
                    "An item can appear once. Change its quantity instead."
                )
            item_ids.add(item_id)
            rows.append((course_code, item_id, quantity))
        conn = self.inventory_dao.get_connection()
        cursor = None

        try:
            conn.start_transaction()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT item_id
                FROM course_bundles
                WHERE course_code = %s
                FOR UPDATE
            """, (course_code,))
            if cursor.fetchall():
                raise FileExistsError(
                    f"Bundle {course_code} already exists."
                )
            ids = sorted(item_ids)
            placeholders = ", ".join(["%s"] * len(ids))
            cursor.execute(
                f"SELECT item_id FROM inventory "
                f"WHERE item_id IN ({placeholders}) FOR UPDATE",
                tuple(ids)
            )
            found = {row[0] for row in cursor.fetchall()}
            missing = item_ids - found
            if missing:
                raise ValueError(
                    "Catalog items not found: "
                    + ", ".join(map(str, sorted(missing)))
                )
            cursor.executemany("""
                INSERT INTO course_bundles
                    (course_code, item_id, quantity)
                VALUES (%s, %s, %s)
            """, rows)
            conn.commit()
            return course_code
        except Exception:
            conn.rollback()
            raise
        finally:
            if cursor is not None:
                cursor.close()
            conn.close()