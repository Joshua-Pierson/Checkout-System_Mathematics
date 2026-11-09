class DiscountDAO:
    def __init__(self, inventory_dao):
        self.inventory_dao = inventory_dao

    def get_eligibility_map(self):
        """Returns a dictionary mapping categories to their discount eligibility."""
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT category, student_eligible, employee_eligible FROM category_discounts")
            rows = cursor.fetchall()
            return {
                row["category"]: {
                    "student": bool(row["student_eligible"]), 
                    "employee": bool(row["employee_eligible"])
                } for row in rows
            }
        finally:
            cursor.close()
            conn.close()

    def update_eligibility(self, category, student_eligible, employee_eligible):
        """UPSERTs the eligibility states for a specific category."""
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO category_discounts (category, student_eligible, employee_eligible)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE student_eligible=%s, employee_eligible=%s
            """, (category, bool(student_eligible), bool(employee_eligible), 
                  bool(student_eligible), bool(employee_eligible)))
            conn.commit()
            return True
        finally:
            cursor.close()
            conn.close()

    def get_discount_rules(self):
        """Fetches dynamic rates and types for discount profiles."""
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT profile_name, discount_type, discount_value FROM discount_profiles")
            rows = cursor.fetchall()
            return {
                row["profile_name"]: {
                    "type": row["discount_type"],
                    "value": float(row["discount_value"])
                } for row in rows
            }
        finally:
            cursor.close()
            conn.close()

    def update_discount_rule(self, profile_name, discount_type, discount_value):
        """UPSERTs a global discount rule."""
        if discount_type not in ('percent', 'dollar'):
            raise ValueError("discount_type must be 'percent' or 'dollar'")
            
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO discount_profiles (profile_name, discount_type, discount_value)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE discount_type=%s, discount_value=%s
            """, (profile_name, discount_type, float(discount_value), discount_type, float(discount_value)))
            conn.commit()
            return True
        finally:
            cursor.close()
            conn.close()