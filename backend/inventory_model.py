import csv
import os

class InventoryModel:
    def __init__(self, file_path='backend/data/items.csv'):
        self.file_path = file_path
        # Ensure the file and headers exist upon initialization
        if not os.path.exists(self.file_path):
            with open(self.file_path, mode='w', newline='') as file:
                writer = csv.writer(file)
                writer.writerow(['item_id', 'name', 'unit_price', 'category', 'stock_quantity'])

    def get_all_items(self):
        """Deserializes the CSV into a list of dictionaries."""
        items = []
        with open(self.file_path, mode='r', newline='') as file:
            reader = csv.DictReader(file)
            for row in reader:
                items.append(row)
        return items

    def add_item(self, item_data):
        """Serializes a dictionary object and appends it to the CSV."""
        headers = ['item_id', 'name', 'unit_price', 'category', 'stock_quantity']

        with open(self.file_path, mode='a', newline='') as file:
            writer = csv.DictWriter(file, fieldnames=headers)
            # If file is completely empty, append headers first
            if os.stat(self.file_path).st_size == 0:
                writer.writeheader()

            writer.writerow(item_data)

