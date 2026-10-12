from flask import Flask, jsonify
from flask_cors import CORS
from inventory_model import InventoryModel
from mysql_dao import MySQLInventoryDAO
from sales_dao import SalesDAO
from sales_routes import init_sales_routes
from tax_dao import TaxDAO
from tax_routes import init_tax_routes

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})  # Neutralizes Cross-Origin Resource Sharing strictures
db = InventoryModel(file_path='backend/data/items.csv')

@app.route('/api/items', methods=['GET'])
def get_items():
    """Serializes the CSV data into a JSON payload for the frontend."""
    return jsonify(db.get_all_items()), 200

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    return {"status": "success", "data": []}

# Sales + inventory levels (MySQL): /api/sales, /api/sales/<id>, /api/inventory/levels
inventory_dao = MySQLInventoryDAO()
init_sales_routes(app, SalesDAO(inventory_dao))
# Tax-exempt settings: /api/items/<id>/tax-exempt, /api/categories/<name>/tax-exempt, /api/tax-exemptions
init_tax_routes(app, TaxDAO(inventory_dao))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
