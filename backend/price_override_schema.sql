USE pos_inventory;

CREATE TABLE IF NOT EXISTS price_override_grants (
    token_hash CHAR(64) PRIMARY KEY,
    staff_id VARCHAR(50) NOT NULL,
    item_id INT NOT NULL,
    original_price DECIMAL(10, 2) NOT NULL,
    new_price DECIMAL(10, 2) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE RESTRICT
);
