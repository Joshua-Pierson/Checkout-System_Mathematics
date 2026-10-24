# POS Checkout System

A robust, containerized Point-and-Sale (POS) checkout and inventory management system built with a Python/Flask backend, a MySQL database, a Vite/React frontend, and Docker orchestration.

---

## Architecture & Technology Stack

- **Frontend:** React, Vite, CSS3
- **Backend:** Python, Flask, Flask-CORS
- **Database:** MySQL 8.0 with InnoDB engine
- **Containerization:** Docker & Docker Compose

---

## Core Features & Backend Capabilities

- **Server-Authoritative Calculation Engine:** All subtotals, tax rates, and totals are computed strictly on the backend using canonical database prices to prevent client-side tampering.
- **Atomic Inventory Depletion:** Uses row-level locks (`SELECT ... FOR UPDATE`) and atomic update constraints (`stock_quantity >= quantity`) to prevent race conditions and overselling during concurrent checkouts.
- **Simulated Payment Processing:** 
  - **Cash Transactions:** Validates that `cash_tendered >= total_due`, calculates exact change, and triggers inventory reduction upon success.
  - **Card Transactions:** Implements the Luhn algorithm for validation, checks card length rules, and handles simulated test declines (cards ending in `0002`).
- **Disk-Based Receipt Serialization:** Automatically scaffolds a backend audit directory and serializes itemized transaction metadata into flat-file text records (`backend/receipts/receipt_<transaction_id>.txt`).
- **Dynamic Tax Exemptions:** Supports both item-level and category-wide tax exemptions, seamlessly bypassed during subtotal and tax liability computations.
- **Catalog Management:** Full CRUD operations for inventory items with strict taxonomy enforcement via an immutable whitelist.

---

## Backend API Endpoints

The Flask backend exposes the following routes for data retrieval, calculation, and mutations:

### Read Operations & Computation
- **Get Inventory Catalog:** `GET http://localhost:5001/api/inventory`
- **Get Categories:** `GET http://localhost:5001/api/categories`
- **Calculate Cart Totals:** `POST http://localhost:5001/api/cart/calculate`

### Checkout & Payment Processing
- **Process Cash Checkout:** `POST http://localhost:5001/api/checkout/cash`
- **Process Card Checkout:** `POST http://localhost:5001/api/checkout/card`
- **Retrieve Prior Receipt:** `GET http://localhost:5001/api/receipts/<transaction_id>`

### Catalog Mutations (Manager Operations)
- **Create Item:** `POST http://localhost:5001/api/items`
- **Update Item:** `PUT http://localhost:5001/api/items/<item_id>`
- **Delete Item:** `DELETE http://localhost:5001/api/items/<item_id>`

---

## Quick Start & Installation

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/Joshua-Pierson/Checkout-System_Mathematics.git](https://github.com/Joshua-Pierson/Checkout-System_Mathematics.git)
   cd Checkout-System_Mathematics