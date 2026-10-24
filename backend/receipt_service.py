import os
import uuid
from datetime import datetime

# Scaffold the backend/receipts directory on module load
RECEIPTS_DIR = os.path.join(os.path.dirname(__file__), "receipts")
os.makedirs(RECEIPTS_DIR, exist_ok=True)

def generate_receipt(cart_items, subtotal, total_tax, total_due, payment_method, payment_details):
    """Assembles transactional metadata into a canonical audit document and persists to disk."""
    transaction_id = str(uuid.uuid4())
    timestamp = datetime.now()
    
    lines = [
        "=" * 40,
        "        CAMPUS CHECKOUT RECEIPT",
        "=" * 40,
        f"Transaction ID: {transaction_id}",
        f"Date: {timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
        "-" * 40
    ]
    
    for item in cart_items:
        lines.append(f"{item['name'][:25]:<25} x{item['quantity']}  ${(item['price'] * item['quantity']):.2f}")
        
    lines.extend([
        "-" * 40,
        f"Subtotal:                      ${subtotal:.2f}",
        f"Tax:                           ${total_tax:.2f}",
        f"Total Due:                     ${total_due:.2f}",
        "-" * 40,
        f"Payment Method: {payment_method.upper()}"
    ])
    
    if payment_method == "cash":
        lines.append(f"Cash Tendered:                 ${payment_details.get('cash_tendered', 0):.2f}")
        lines.append(f"Change Due:                    ${payment_details.get('change_due', 0):.2f}")
        
    lines.extend([
        "=" * 40,
        "          Thank you for shopping!"
    ])
    
    receipt_text = "\n".join(lines)
    file_path = os.path.join(RECEIPTS_DIR, f"receipt_{transaction_id}.txt")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(receipt_text)
        
    return {
        "transaction_id": transaction_id,
        "timestamp": timestamp.isoformat(),
        "receipt_text": receipt_text,
        "file_path": file_path
    }