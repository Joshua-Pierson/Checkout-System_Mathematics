-- Sales tables for the checkout system.
-- A FRESH Docker database already gets these from init.sql.
-- Run this only to upgrade a database that was created before (old mysql_data volume).
USE pos_inventory;

-- One row per completed (paid) sale.
CREATE TABLE IF NOT EXISTS sales (
    sale_id        INT AUTO_INCREMENT PRIMARY KEY,
    payment_method VARCHAR(10)    NOT NULL,          -- 'cash' or 'card'
    subtotal       DECIMAL(10, 2) NOT NULL,
    tax            DECIMAL(10, 2) NOT NULL,
    total          DECIMAL(10, 2) NOT NULL,
    amount_paid    DECIMAL(10, 2) NOT NULL,
    change_due     DECIMAL(10, 2) NOT NULL DEFAULT 0,
    card_last4     CHAR(4) NULL,                     -- never the full card number
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One row per item line in a sale (this is the itemized receipt data).
-- Name and prices are copied so old receipts stay correct if a price changes later.
CREATE TABLE IF NOT EXISTS sale_items (
    sale_item_id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id      INT            NOT NULL,
    item_id      INT            NOT NULL,
    name         VARCHAR(255)   NOT NULL,
    unit_price   DECIMAL(10, 2) NOT NULL,
    quantity     INT            NOT NULL,
    tax_rate     DECIMAL(5, 4)  NOT NULL,
    line_total   DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
);
