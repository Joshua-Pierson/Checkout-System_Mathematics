USE pos_inventory;

CREATE TABLE IF NOT EXISTS multibuy_bundles (
    item_id INT PRIMARY KEY,
    trigger_quantity INT NOT NULL,
    bundle_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (item_id) REFERENCES inventory(item_id) ON DELETE CASCADE
);