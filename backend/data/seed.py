import csv
import time
import os
import mysql.connector
from mysql.connector import Error


def get_db_connection():
    """Loops until the MySQL daemon is ready to accept connections."""
    for attempt in range(15):
        try:
            conn = mysql.connector.connect(
                host=os.environ.get("DB_HOST", "db"),
                user=os.environ.get("DB_USER", "root"),
                password=os.environ.get("DB_PASSWORD", "rootpassword"),
                database=os.environ.get("DB_NAME", "pos_inventory"),
            )
            if conn.is_connected():
                return conn
        except Error:
            time.sleep(2)
    raise Exception("Database connection timeout. MySQL failed to initialize.")


def seed_database():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify if data already exists to prevent duplicate ingestion on container restarts
    cursor.execute("SELECT COUNT(*) FROM inventory")
    if cursor.fetchone()[0] == 0:
        if os.path.exists("inventory.csv"):
            with open("inventory.csv", mode="r") as file:
                csv_reader = csv.DictReader(file)
                for row in csv_reader:
                    cursor.execute(
                        """INSERT INTO inventory 
                        (name, unit_price, category, stock_quantity, tax_rate) 
                        VALUES (%s, %s, %s, %s, %s)""",
                        (
                            row["name"],
                            row["unit_price"],
                            row["category"],
                            row["stock_quantity"],
                            row["tax_rate"],
                        ),
                    )
            conn.commit()
            print("Database successfully seeded from CSV.")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    seed_database()
