import os
import mysql.connector
from dotenv import load_dotenv

# Explicitly load your environment variables before the class initializes
load_dotenv("backend/db_access.env")

class InventoryModel:
    # Immutable whitelist establishing the canonical taxonomy
    AUTHORIZED_CATEGORIES = frozenset([
        "snacks", "drinks", "stationery", "exam supplies", 
        "art supplies", "apparel", "course supplies", "BOOKS!"
    ])

    def __init__(self):
        self.host = os.environ.get('DB_HOST', 'db')
        self.user = os.environ.get('DB_USER', 'root')
        self.password = os.environ.get('DB_PASSWORD', 'rootpassword')
        self.database = os.environ.get('DB_NAME', 'pos_inventory')

    def get_connection(self):
        return mysql.connector.connect(
            host=self.host,
            user=self.user,
            password=self.password,
            database=self.database
        )

    def _validate_category(self, category):
        """Intercepts unauthorized category strings before database execution."""
        if category not in self.AUTHORIZED_CATEGORIES:
            raise ValueError(
                f"Taxonomy Violation: '{category}' is not an authorized category. "
                f"Must be one of: {', '.join(self.AUTHORIZED_CATEGORIES)}"
            )

    def add_item(self, data):
        """Validates payload and executes SQL INSERT."""
        self._validate_category(data.get('category'))
        
        query = """
            INSERT INTO inventory (name, unit_price, category, stock_quantity, tax_rate)
            VALUES (%s, %s, %s, %s, %s)
        """
        values = (
            data['name'], data['unit_price'], data['category'],
            data.get('stock_quantity', 0), data['tax_rate']
        )
        
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(query, values)
            conn.commit()
            return cursor.lastrowid
        finally:
            if 'cursor' in locals(): cursor.close()
            if 'conn' in locals() and conn.is_connected(): conn.close()

    def update_item(self, item_id, data):
        """Validates payload if category is being updated, then executes SQL UPDATE."""
        if 'category' in data:
            self._validate_category(data['category'])

        # Dynamically construct the UPDATE query based on provided keys
        update_fields = []
        values = []
        for key in ['name', 'unit_price', 'category', 'stock_quantity', 'tax_rate']:
            if key in data:
                update_fields.append(f"{key} = %s")
                values.append(data[key])
                
        if not update_fields:
            return False

        query = f"UPDATE inventory SET {', '.join(update_fields)} WHERE item_id = %s"
        values.append(item_id)

        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(query, tuple(values))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            if 'cursor' in locals(): cursor.close()
            if 'conn' in locals() and conn.is_connected(): conn.close()

    def decrement_stock(self, item_id, quantity):
        """Executes an atomic decrement operation to enforce inventory constraints."""
        if quantity < 1:
            raise ValueError("Decrement quantity must be strictly positive.")

        query = """
            UPDATE inventory 
            SET stock_quantity = stock_quantity - %s 
            WHERE item_id = %s AND stock_quantity >= %s
        """
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(query, (quantity, item_id, quantity))
            conn.commit()

            if cursor.rowcount == 0:
                raise ValueError(f"Transaction aborted: Insufficient stock or invalid item ID for {item_id}.")
            return True
        finally:
            if 'cursor' in locals(): cursor.close()
            if 'conn' in locals() and conn.is_connected(): conn.close()

    def delete_item(self, item_id):
        """Executes SQL DELETE."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM inventory WHERE item_id = %s", (item_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            if 'cursor' in locals(): cursor.close()
            if 'conn' in locals() and conn.is_connected(): conn.close()

if __name__ == "__main__":
    # Test script updated to verify the correct unified class
    dao = InventoryModel()
    try:
        connection = dao.get_connection()
        print("Database connection established successfully:", connection.is_connected())
    except Exception as e:
        print("Database connection failed:", str(e))
    finally:
        if 'connection' in locals() and connection.is_connected():
            connection.close()