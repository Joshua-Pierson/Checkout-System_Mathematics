USE pos_inventory;

CREATE TABLE IF NOT EXISTS course_bundles (
    course_code VARCHAR(50) NOT NULL,
    item_id INT NOT NULL,
    quantity INT DEFAULT 1,
    PRIMARY KEY (course_code, item_id),
    FOREIGN KEY (item_id) REFERENCES inventory(item_id) ON DELETE CASCADE
);