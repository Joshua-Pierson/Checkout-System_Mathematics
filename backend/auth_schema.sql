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
('ADMIN', 'System Admin', 'scrypt:32768:8:1$VvfrkzCHMSGSJrKI$cadbd244bc0648073b6c8b214458f30e68c396317e250553534d69a7b5dbcfa9981f87e435da97b53ba857db155171e47c2a2b5d808ef728eba140cd1fc71e42', 'manager');