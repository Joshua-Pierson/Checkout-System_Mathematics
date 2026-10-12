-- Tax-exempt + card payment changes. Run AFTER sales_schema.sql.
USE checkout_system;

-- Item-level exemption: TRUE means this item is never taxed.
ALTER TABLE inventory_records
    ADD COLUMN tax_exempt BOOLEAN NOT NULL DEFAULT FALSE;

-- Category-level exemption: every item in a listed category is not taxed
-- (new items added to that category later are covered automatically).
CREATE TABLE IF NOT EXISTS tax_exempt_categories (
    category   VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Card payments: keep ONLY the last 4 digits, never the full card number.
ALTER TABLE sales
    ADD COLUMN card_last4 CHAR(4) NULL;
