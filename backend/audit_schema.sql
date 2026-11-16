USE pos_inventory;

CREATE TABLE IF NOT EXISTS override_audit_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    item_id INT NOT NULL,
    details VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE RESTRICT
);
