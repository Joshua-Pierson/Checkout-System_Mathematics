USE pos_inventory;

CREATE TABLE IF NOT EXISTS staff (
    staff_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'cashier',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bootstrap Admin Account (Staff ID: ADMIN, PIN: 1234)
-- This allows the manager to log into the UI initially to create the real accounts.
INSERT IGNORE INTO staff (staff_id, name, pin_hash, role) VALUES 
('ADMIN', 'System Admin', 'scrypt:32768:8:1$u7F5A8b1$7e8c9b3a7b95c010d7a6e133e5c9b0a1d48c8b6b15802a82987114b0b2e8a107', 'manager');