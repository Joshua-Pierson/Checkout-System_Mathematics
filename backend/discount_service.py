def verify_student_id(student_id):
    if not student_id:
        return False
    return len(str(student_id).strip()) >= 4

def verify_employee_id(employee_id):
    if not employee_id:
        return False
    return len(str(employee_id).strip()) >= 4

def _apply_line_discounts(receipt_items, eligibility_map, profile, rule, eligible_total, total_savings):
    """Distributes the winning discount across eligible line items."""
    remaining_savings = total_savings
    
    # Isolate only the items eligible for this specific profile
    eligible_items = [
        i for i in receipt_items 
        if eligibility_map.get(i.get("category", ""), {}).get(profile, profile == "employee")
    ]

    for index, item in enumerate(eligible_items):
        line_tot = item["price"] * item["quantity"]
        
        if rule["type"] == "percent":
            item_disc = round(line_tot * (rule["value"] / 100.0), 2)
        else:
            # Pro-rate flat dollar discounts across items to maintain accurate line-item taxes
            if index == len(eligible_items) - 1:
                item_disc = remaining_savings  # Sweep remaining pennies to the final item
            else:
                weight = line_tot / eligible_total
                item_disc = round(weight * total_savings, 2)

        # Safeguard: Never discount a line item below $0.00
        item_disc = min(item_disc, line_tot)
        item["discount"] = item_disc
        remaining_savings = round(remaining_savings - item_disc, 2)

def calculate_discounts(receipt_items, student_id, employee_id, eligibility_map, discount_rules):
    """
    Evaluates dynamic percentage and flat-dollar rulesets and strictly enforces value-based mutual exclusion.
    """
    is_student = verify_student_id(student_id)
    is_employee = verify_employee_id(employee_id)
    
    # Fallback legacy defaults if DB is missing rows
    stud_rule = discount_rules.get("student", {"type": "percent", "value": 15.0})
    emp_rule = discount_rules.get("employee", {"type": "percent", "value": 20.0})
    
    stud_eligible_total = 0.0
    emp_eligible_total = 0.0
    
    # Reset all discounts
    for item in receipt_items:
        item["discount"] = 0.0

    # 1. Compute eligible subtotals
    for item in receipt_items:
        cat = item.get("category", "")
        line_tot = item["price"] * item["quantity"]
        if eligibility_map.get(cat, {}).get("student", False):
            stud_eligible_total += line_tot
        if eligibility_map.get(cat, {}).get("employee", True):
            emp_eligible_total += line_tot

    # 2. Compute theoretical savings
    stud_savings = 0.0
    if is_student and stud_eligible_total > 0:
        if stud_rule["type"] == "percent":
            stud_savings = stud_eligible_total * (stud_rule["value"] / 100.0)
        else:
            stud_savings = min(stud_rule["value"], stud_eligible_total) # Cap flat discounts at subtotal

    emp_savings = 0.0
    if is_employee and emp_eligible_total > 0:
        if emp_rule["type"] == "percent":
            emp_savings = emp_eligible_total * (emp_rule["value"] / 100.0)
        else:
            emp_savings = min(emp_rule["value"], emp_eligible_total) # Cap flat discounts at subtotal

    stud_savings = round(stud_savings, 2)
    emp_savings = round(emp_savings, 2)
    
    # 3. Conflict Resolution: Apply the higher monetary value
    if emp_savings > 0 and emp_savings >= stud_savings:
        _apply_line_discounts(receipt_items, eligibility_map, "employee", emp_rule, emp_eligible_total, emp_savings)
        return {"type": "Employee", "id": employee_id, "amount": emp_savings}
        
    elif stud_savings > 0:
        _apply_line_discounts(receipt_items, eligibility_map, "student", stud_rule, stud_eligible_total, stud_savings)
        return {"type": "Student", "id": student_id, "amount": stud_savings}
        
    return {"type": None, "id": None, "amount": 0.0}