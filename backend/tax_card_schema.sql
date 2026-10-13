-- Tax-exempt changes for the checkout system.
-- A FRESH Docker database already gets these from init.sql.
-- Run this only to upgrade a database that was created before (old mysql_data volume).
USE pos_inventory;

-- Item-level exemption: TRUE means this item is never taxed.
-- Remove this line if the column already exists.
ALTER TABLE inventory
    ADD COLUMN tax_exempt BOOLEAN NOT NULL DEFAULT FALSE;

-- Category-level exemption: every item in a listed category is not taxed
-- (new items added to that category later are covered automatically).
CREATE TABLE IF NOT EXISTS tax_exempt_categories (
    category   VARCHAR(100) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
