from flask import Flask, jsonify
from flask_cors import CORS
from inventory_model import InventoryModel

app = Flask(__name__)
CORS(app) # Neutralizes Cross-Origin Resource Sharing strictures
db = InventoryModel(file_path='data/items.csv')

@app.route('/api/items', methods=['GET'])
def get_items():
    """Serializes the CSV data into a JSON payload for the frontend."""
    return jsonify(db.get_all_items()), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)