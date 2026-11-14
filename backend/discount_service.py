def verify_student_id(student_id):
    if not student_id:
        return False
    return len(str(student_id).strip()) >= 4

def verify_employee_id(employee_id):
    if not employee_id:
        return False
    return len(str(employee_id).strip()) >= 4

def apply_multibuy(price, quantity, rule):
    """Calculates the base line total applying multi-buy bundles if eligible."""
    if rule and quantity >= rule["trigger"]:
        bundles = quantity // rule["trigger"]
        remainder = quantity % rule["trigger"]
        line_total = (bundles * rule["price"]) + (remainder * price)
        return round(line_total, 2), True
    return round(price * quantity, 2), False

def _apply_line_discounts(receipt_items, eligibility_map, profile, rule, eligible_total, total_savings):
    """Distributes the winning global discount across eligible line items."""
    remaining_savings = total_savings
    
    eligible_items = [
        i for i in receipt_items 
        if eligibility_map.get(i.get("category", ""), {}).get(profile, profile == "employee")
    ]

    for index, item in enumerate(eligible_items):
        line_tot = item["line_total"]
        
        if rule["type"] == "percent":
            item_disc = round(line_tot * (rule["value"] / 100.0), 2)
        else:
            if index == len(eligible_items) - 1:
                item_disc = remaining_savings
            else:
                weight = line_tot / eligible_total
                item_disc = round(weight * total_savings, 2)

        item_disc = min(item_disc, line_tot)
        item["discount"] = item_disc
        remaining_savings = round(remaining_savings - item_disc, 2)

def calculate_discounts(receipt_items, student_id, employee_id, eligibility_map, discount_rules):
    """
    Evaluates dynamic percentage and flat-dollar rulesets against bundled line subtotals.
    """
    is_student = verify_student_id(student_id)
    is_employee = verify_employee_id(employee_id)
    
    stud_rule = discount_rules.get("student", {"type": "percent", "value": 15.0})
    emp_rule = discount_rules.get("employee", {"type": "percent", "value": 20.0})
    
    stud_eligible_total = 0.0
    emp_eligible_total = 0.0
    
    for item in receipt_items:
        item["discount"] = 0.0

    for item in receipt_items:
        cat = item.get("category", "")
        line_tot = item["line_total"]
        if eligibility_map.get(cat, {}).get("student", False):
            stud_eligible_total += line_tot
        if eligibility_map.get(cat, {}).get("employee", True):
            emp_eligible_total += line_tot

    stud_savings = 0.0
    if is_student and stud_eligible_total > 0:
        if stud_rule["type"] == "percent":
            stud_savings = stud_eligible_total * (stud_rule["value"] / 100.0)
        else:
            stud_savings = min(stud_rule["value"], stud_eligible_total)

    emp_savings = 0.0
    if is_employee and emp_eligible_total > 0:
        if emp_rule["type"] == "percent":
            emp_savings = emp_eligible_total * (emp_rule["value"] / 100.0)
        else:
            emp_savings = min(emp_rule["value"], emp_eligible_total)

    stud_savings = round(stud_savings, 2)
    emp_savings = round(emp_savings, 2)
    
    if emp_savings > 0 and emp_savings >= stud_savings:
        _apply_line_discounts(receipt_items, eligibility_map, "employee", emp_rule, emp_eligible_total, emp_savings)
        return {"type": "Employee", "id": employee_id, "amount": emp_savings}
        
    elif stud_savings > 0:
        _apply_line_discounts(receipt_items, eligibility_map, "student", stud_rule, stud_eligible_total, stud_savings)
        return {"type": "Student", "id": student_id, "amount": stud_savings}
        
    return {"type": None, "id": None, "amount": 0.0}