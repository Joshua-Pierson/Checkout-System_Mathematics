#!/bin/bash

# 1. Execute the resilient database seed script
python seed.py

# 2. Hand over execution to the Flask server
# (Using host 0.0.0.0 binds it to all network interfaces, allowing the frontend container to reach it)
flask run --host=0.0.0.0