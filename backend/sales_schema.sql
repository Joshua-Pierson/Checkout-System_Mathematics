-- Sales tables for the checkout system.
-- Run AFTER inventory_schema.sql (needs the inventory_records table).
USE checkout_system;

-- Tax rate per item (0.0000 = tax-exempt). Default is the Texas rate 8.25%.
-- Remove this line if the column already exists.
ALTER TABLE inventory_records
    ADD COLUMN tax_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0825;

-- One row per completed (paid) sale.
CREATE TABLE IF NOT EXISTS sales (
    sale_id        INT AUTO_INCREMENT PRIMARY KEY,
    payment_method VARCHAR(10)    NOT NULL,          -- 'cash' or 'card'
    subtotal       DECIMAL(10, 2) NOT NULL,
    tax            DECIMAL(10, 2) NOT NULL,
    total          DECIMAL(10, 2) NOT NULL,
    amount_paid    DECIMAL(10, 2) NOT NULL,
    change_due     DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One row per item line in a sale (this is the itemized receipt data).
-- Name and prices are copied so old receipts stay correct if a price changes later.
CREATE TABLE IF NOT EXISTS sale_items (
    sale_item_id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id      INT            NOT NULL,
    item_id      VARCHAR(50)    NOT NULL,
    name         VARCHAR(100)   NOT NULL,
    unit_price   DECIMAL(10, 2) NOT NULL,
    quantity     INT            NOT NULL,
    tax_rate     DECIMAL(5, 4)  NOT NULL,
    line_total   DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
);
