"""Old entry point, kept so `python backend/server.py` still works.

The app now lives in main.py (that is what Docker runs: FLASK_APP=main.py),
and main.py registers every route, including sales, tax and catalog.
"""
from main import app

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
