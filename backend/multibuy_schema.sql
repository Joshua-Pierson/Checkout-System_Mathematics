USE pos_inventory;

CREATE TABLE IF NOT EXISTS multibuy_bundles (
    item_id INT PRIMARY KEY,
    trigger_quantity INT NOT NULL,
    bundle_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (item_id) REFERENCES inventory(item_id) ON DELETE CASCADE
);

-- Seed an example deal (assuming item 1003 exists)
INSERT IGNORE INTO multibuy_bundles (item_id, trigger_quantity, bundle_price) VALUES 
(1003, 5, 12.00);