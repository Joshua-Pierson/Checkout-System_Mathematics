from werkzeug.security import generate_password_hash, check_password_hash

class AuthService:
    def __init__(self, inventory_dao):
        self.inventory_dao = inventory_dao

    def create_staff(self, staff_id, name, pin, role="cashier"):
        """
        Hashes the PIN dynamically so managers can create staff from the React UI
        without needing terminal access.
        """
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor()
        try:
            pin_hash = generate_password_hash(str(pin))
            cursor.execute("""
                INSERT INTO staff (staff_id, name, pin_hash, role) 
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE name=%s, pin_hash=%s, role=%s
            """, (
                str(staff_id).strip(), name.strip(), pin_hash, role,
                name.strip(), pin_hash, role
            ))
            conn.commit()
            return True
        finally:
            cursor.close()
            conn.close()

    def verify_staff_credentials(self, staff_id, pin):
        """
        Queries the database for the staff_id and securely compares 
        the provided PIN against the stored hash.
        """
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("""
                SELECT staff_id, name, role, pin_hash 
                FROM staff 
                WHERE staff_id = %s
            """, (str(staff_id).strip(),))
            
            staff_record = cursor.fetchone()
            
            if not staff_record or not check_password_hash(staff_record["pin_hash"], str(pin)):
                return False, None
                
            del staff_record["pin_hash"]
            return True, staff_record
            
        finally:
            cursor.close()
            conn.close()