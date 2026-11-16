export const eligibilityChanged = (row, original) =>
  row.student_eligible !== original.student_eligible || row.employee_eligible !== original.employee_eligible;

// The backend saves one category at a time. Retain successful saves if another fails.
export async function saveEligibilityChanges(original, drafts, update) {
  const saved = [];
  const failed = [];
  for (const row of drafts) {
    const before = original.find((entry) => entry.category === row.category);
    if (!before || !eligibilityChanged(row, before)) continue;
    try {
      await update(row.category, { student_eligible: row.student_eligible, employee_eligible: row.employee_eligible });
      saved.push({ ...row });
    } catch (error) { failed.push({ category: row.category, message: error.message }); }
  }
  return { saved, failed };
}
