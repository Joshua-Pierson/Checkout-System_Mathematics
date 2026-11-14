USE pos_inventory;

ALTER TABLE override_audit_log
ADD COLUMN original_price DECIMAL(10, 2) NULL,
ADD COLUMN new_price DECIMAL(10, 2) NULL;
