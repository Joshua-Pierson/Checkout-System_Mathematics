# Main backend application.
# Start the Flask server and serve the frontend.
# Register the manager, student cart, and checkout API routes.
# Run this file to start the application.

# Start the backend and register the student cart routes.

import os
import secrets
from pathlib import Path

from flask import Flask

from student_cart import student_cart


frontend_folder = Path(__file__).resolve().parent.parent / "frontend"

app = Flask(
    __name__,
    static_folder=str(frontend_folder),
    static_url_path=""
)

# Flask needs a secret key to protect browser session cookies.
# The generated development key changes when the server restarts.
app.secret_key = os.getenv("SECRET_KEY") or secrets.token_hex(32)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax"
)

app.register_blueprint(student_cart)


@app.get("/")
def homepage():
    return app.send_static_file("index.html")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
