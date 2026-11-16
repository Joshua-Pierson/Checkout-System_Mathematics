CREATE DATABASE IF NOT EXISTS pos_inventory;
USE pos_inventory;

CREATE TABLE IF NOT EXISTS inventory (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    stock_quantity INT DEFAULT 0,
    tax_rate DECIMAL(5, 4) NOT NULL,
    tax_exempt BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = this item is never taxed
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------- Sales, receipts, tax-exempt (Henry) ----------
-- Same tables as sales_schema.sql + tax_card_schema.sql, so a fresh Docker
-- database has everything. Keep them in sync if you change one.

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

-- One row per item line in a sale (the itemized receipt).
-- Name and price are copied so old receipts stay correct if a price changes.
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

-- Category-level exemption: every item in a listed category is not taxed.
CREATE TABLE IF NOT EXISTS tax_exempt_categories (
    category   VARCHAR(100) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
