/**
 * The exceptions queue's check labels. Each rule's full label still carries
 * the "(sample result)" marker the checks engine stamps on every mock
 * result; the list drops it and shortens the wording so the column scans at
 * a glance. A label this map does not know is shown as is, with only the
 * marker removed, so a new rule never renders blank.
 */
const SHORT_CHECK_LABELS: Record<string, string> = {
  "Packing list quantity against the PO": "PL vs PO",
  "Unit price on the PI against the PO": "PI vs PO",
  "Shipping document received on time": "AWB / BL upload deadline",
};

export function checkLabelOf(ruleLabel: string): string {
  const cleaned = ruleLabel.replace(/\s*\(sample result\)\s*$/i, "").trim();
  return SHORT_CHECK_LABELS[cleaned] ?? cleaned;
}
