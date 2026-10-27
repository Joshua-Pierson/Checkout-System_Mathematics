def verify_student_id(student_id):
    """Validates student ID format. Requires a non-empty string of at least 4 characters."""
    if not student_id:
        return False
    return len(str(student_id).strip()) >= 4

def calculate_discounts(receipt_items, student_id):
    """Applies a 15% discount to eligible categories for verified students."""
    is_student = verify_student_id(student_id)
    total_discount = 0.0
    
    # Target categories for the 15% student discount
    eligible_categories = {"books", "course supplies", "apparel"}

    for item in receipt_items:
        item["discount"] = 0.0
        if is_student and item.get("category", "").lower() in eligible_categories:
            discount = (item["price"] * item["quantity"]) * 0.15
            item["discount"] = round(discount, 2)
            total_discount += item["discount"]

    return is_student, round(total_discount, 2)