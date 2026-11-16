export function discountLabel(type) {
  if (type === 'Employee') return 'Employee Discount';
  if (type === 'Student') return 'Student Discount';
  return 'Discount';
}
