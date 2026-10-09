CREATE DATABASE IF NOT EXISTS checkout_system;
USE checkout_system;

CREATE TABLE IF NOT EXISTS inventory_records (
    item_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE DATABASE IF NOT EXISTS checkout_system;
USE checkout_system;

from backend.mysql_dao import MySQLInventoryDAO

dao = MySQLInventoryDAO()
connection = dao.get_connection()
print("Database connection pool established successfully:", connection.is_connected())
connection.close()