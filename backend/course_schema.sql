USE pos_inventory;

CREATE TABLE IF NOT EXISTS course_bundles (
    course_code VARCHAR(50) NOT NULL,
    item_id INT NOT NULL,
    quantity INT DEFAULT 1,
    PRIMARY KEY (course_code, item_id),
    FOREIGN KEY (item_id) REFERENCES inventory(item_id) ON DELETE CASCADE
);

-- Seed initial test bundles mapping to your existing items
INSERT IGNORE INTO course_bundles (course_code, item_id, quantity) VALUES 
('CS101', 1001, 1), -- Introduction to Algorithms
('CS101', 1003, 2), -- 2 Blue Scantrons
('MATH201', 1002, 1), -- Graphing Calculator TI-84
('MATH201', 1003, 5); -- 5 Blue Scantrons