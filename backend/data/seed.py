import csv
import time
import os
import mysql.connector
from mysql.connector import Error

def connect_with_retry():
    """Loops until the MySQL container is ready to accept connections."""
    max_retries = 15
    for attempt in range(max_retries):
        try:
            conn = mysql.connector.connect(
                host=os.environ.get('DB_HOST', 'db'),
                user=os.environ.get('DB_USER', 'root'),
                password=os.environ.get('DB_PASSWORD', 'rootpassword'),
                database=os.environ.get('DB_NAME', 'pos_inventory')
            )
            if conn.is_connected():
                return conn
        except Error:
            time.sleep(2)
    raise Exception("Database connection timeout.")

def seed_database():
    conn = connect_with_retry()
    cursor = conn.cursor()
    
    # The init.sql file handles table creation, but the script can also verify it here
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS inventory (
            item_id INT AUTO_INCREMENT PRIMARY KEY,
            sku VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            stock_quantity INT DEFAULT 0
        )
    """)

    # Check if data already exists to prevent duplicate seeding on container restarts
    cursor.execute("SELECT COUNT(*) FROM inventory")
    if cursor.fetchone()[0] == 0:
        with open('inventory.csv', mode='r') as file:
            csv_reader = csv.DictReader(file)
            for row in csv_reader:
                cursor.execute(
                    "INSERT INTO inventory (sku, name, price, stock_quantity) VALUES (%s, %s, %s, %s)",
                    (row['sku'], row['name'], row['price'], row['stock_quantity'])
                )
        conn.commit()
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    seed_database()