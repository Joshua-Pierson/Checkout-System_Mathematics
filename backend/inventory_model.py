import csv
import os

class InventoryModel:
    def __init__(self, file_path='backend/data/items.csv'):
        self.file_path = file_path
        
        # Ensure the parent directory exists to prevent FileNotFoundError
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        
        # Ensure the file and headers exist upon initialization with the new schema
        if not os.path.exists(self.file_path):
            with open(self.file_path, mode='w', newline='') as file:
                writer = csv.writer(file)
                writer.writerow(['item_id', 'name', 'unit_price', 'category', 'stock_quantity', 'tax_rate'])

    def get_all_items(self):
        """Deserializes the CSV into a list of dictionaries with type casting."""
        items = []
        with open(self.file_path, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                item = {
                    'item_id': int(row['item_id']),
                    'name': row['name'],
                    'unit_price': float(row['unit_price']),
                    'category': row['category'],
                    'stock_quantity': int(row['stock_quantity']),
                    'tax_rate': float(row.get('tax_rate', 0.0))  # Schema injection with 0.0 fallback
                }
                items.append(item)
        return items

    def add_item(self, item_data):
        """Serializes a dictionary object and appends it to the CSV."""
        headers = ['item_id', 'name', 'unit_price', 'category', 'stock_quantity', 'tax_rate']

        with open(self.file_path, mode='a', newline='') as file:
            writer = csv.DictWriter(file, fieldnames=headers)
            if os.stat(self.file_path).st_size == 0:
                writer.writeheader()

            writer.writerow(item_data)