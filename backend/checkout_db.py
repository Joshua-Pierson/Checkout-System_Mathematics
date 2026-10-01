# Shared MySQL connection.
# Provide a connection function for the other backend files.
# database connection settings here.
# backend files call get_connection() to access the database.
# remember to close the connection when finished.
import os
import mysql.connector


def get_connection():
    """Create and return a new MySQL connection."""

    password = os.getenv("DB_PASSWORD")

    if password is None:
        raise RuntimeError(
            "Set DB_PASSWORD in your terminal before starting the backend."
        )

    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=password,
        database=os.getenv("DB_NAME", "checkout_mathematics"),
        connection_timeout=10
    )
