class AuditDAO:
    def __init__(self, inventory_dao):
        self.inventory_dao = inventory_dao

    def log_override(self, staff_id, action_type, item_id, details=""):
        """
        Permanently persists a staff override action to the audit ledger.
        The database automatically generates the precise timestamp.
        """
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO override_audit_log (staff_id, action_type, item_id, details)
                VALUES (%s, %s, %s, %s)
            """, (str(staff_id).strip(), str(action_type).strip().upper(), int(item_id), str(details).strip()))
            conn.commit()
            return cursor.lastrowid
        finally:
            cursor.close()
            conn.close()

    def log_price_override(self, staff_id, item_id, original_price, new_price, reason):
        """
        Permanently persists a staff price mutation to the audit ledger.
        Captures the financial delta and the mandatory justification.
        """
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO override_audit_log 
                (staff_id, action_type, item_id, original_price, new_price, details)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                str(staff_id).strip(), 
                "PRICE_OVERRIDE", 
                int(item_id), 
                float(original_price), 
                float(new_price), 
                str(reason).strip()
            ))
            conn.commit()
            return cursor.lastrowid
        finally:
            cursor.close()
            conn.close()