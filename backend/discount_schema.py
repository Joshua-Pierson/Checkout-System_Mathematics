USE pos_inventory;

CREATE TABLE IF NOT EXISTS category_discounts (
    category VARCHAR(100) PRIMARY KEY,
    student_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    employee_eligible BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed initial legacy behavior
INSERT IGNORE INTO category_discounts (category, student_eligible, employee_eligible) VALUES 
('books', TRUE, TRUE),
('course supplies', TRUE, TRUE),
('apparel', TRUE, TRUE);

USE pos_inventory;

CREATE TABLE IF NOT EXISTS discount_profiles (
    profile_name VARCHAR(50) PRIMARY KEY,
    discount_type ENUM('percent', 'dollar') NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL
);

-- Seed initial legacy behavior
INSERT IGNORE INTO discount_profiles (profile_name, discount_type, discount_value) VALUES 
('student', 'percent', 15.00),
('employee', 'percent', 20.00);