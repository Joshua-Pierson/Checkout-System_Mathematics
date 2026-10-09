import os
from dotenv import load_dotenv
from mysql.connector import pooling
from mysql.connector.pooling import PooledMySQLConnection

# Explicitly load your environment variables before the class initializes
load_dotenv("backend/db_access.env")

class MySQLInventoryDAO:
    def __init__(self):
        self.connection_pool = pooling.MySQLConnectionPool(
            pool_name="inventory_pool",
            pool_size=5,
            pool_reset_session=True,
            host=os.getenv("DB_HOST", "127.0.0.1"),
            port=3307,
            database=os.getenv("DB_NAME", "pos_inventory"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", "")
        )

    def get_connection(self) -> PooledMySQLConnection:
        return self.connection_pool.get_connection()

    def get_item(self, item_id: str):
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            query = "SELECT * FROM inventory_records WHERE item_id = %s"
            cursor.execute(query, (item_id,))
            return cursor.fetchone()
        finally:
            cursor.close()
            conn.close()

    def update_stock(self, item_id: str, quantity: int):
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            query = "UPDATE inventory_records SET stock_quantity = stock_quantity - %s WHERE item_id = %s"
            cursor.execute(query, (quantity, item_id))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def add_item(self, item_id: str, name: str, category: str, price: float, stock_quantity: int):
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            query = """
                INSERT INTO inventory_records (item_id, name, category, price, stock_quantity)
                VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(query, (item_id, name, category, price, stock_quantity))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def update_item(self, item_id: str, name: str, category: str, price: float, stock_quantity: int):
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            query = """
                UPDATE inventory_records 
                SET name = %s, category = %s, price = %s, stock_quantity = %s 
                WHERE item_id = %s
            """
            cursor.execute(query, (name, category, price, stock_quantity, item_id))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def delete_item(self, item_id: str):
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            query = "DELETE FROM inventory_records WHERE item_id = %s"
            cursor.execute(query, (item_id,))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

if __name__ == "__main__":
    dao = MySQLInventoryDAO()
    connection = dao.get_connection()
    print("Database connection pool established successfully:", connection.is_connected())
    connection.close()