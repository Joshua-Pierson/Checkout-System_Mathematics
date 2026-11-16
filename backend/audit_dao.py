import hashlib


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

    def authorize_price_override(self, staff_id, item_id, original_price, new_price, reason, token):
        """
        Records an authorized price override and issues a short-lived grant.
        """
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
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
            cursor.execute("""
                INSERT INTO price_override_grants
                (token_hash, staff_id, item_id, original_price, new_price, expires_at)
                VALUES (%s, %s, %s, %s, %s, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))
            """, (token_hash, str(staff_id).strip(), int(item_id), float(original_price), float(new_price)))
            conn.commit()
            return token
        finally:
            cursor.close()
            conn.close()

    def get_price_override_grant(self, token, item_id):
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("""
                SELECT staff_id, item_id, original_price, new_price
                FROM price_override_grants
                WHERE token_hash = %s AND item_id = %s
                  AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
            """, (token_hash, int(item_id)))
            return cursor.fetchone()
        finally:
            cursor.close()
            conn.close()

    def consume_price_override_grants(self, tokens):
        hashes = [hashlib.sha256(token.encode("utf-8")).hexdigest() for token in tokens]
        conn = self.inventory_dao.get_connection()
        cursor = conn.cursor()
        try:
            for token_hash in hashes:
                cursor.execute("""
                    UPDATE price_override_grants
                    SET used_at = UTC_TIMESTAMP()
                    WHERE token_hash = %s AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
                """, (token_hash,))
                if cursor.rowcount != 1:
                    conn.rollback()
                    raise ValueError("A price override authorization has expired or was already used.")
            conn.commit()
        finally:
            cursor.close()
            conn.close()