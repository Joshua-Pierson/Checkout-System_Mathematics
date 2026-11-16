class CourseDAO:
    def __init__(self, inventory_dao):
        self.inventory_dao = inventory_dao

    def get_course_bundle(self, course_code):
        """Fetches all items required for a course, including their current live stock."""
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("""
                SELECT cb.item_id, cb.quantity as required_quantity, 
                       i.name, i.unit_price, i.category, i.tax_rate, i.stock_quantity
                FROM course_bundles cb
                JOIN inventory i ON cb.item_id = i.item_id
                WHERE cb.course_code = %s
            """, (course_code.upper(),))
            return cursor.fetchall()
        finally:
            cursor.close()
            conn.close()