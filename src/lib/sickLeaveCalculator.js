// Article 42 — Leave – Sick (accumulation per month of service)
// FT:  1.5 working days / month  = 18 days / year
// PT:  (hours paid / month × 1.5) / 162.5  →  FTE × 18 days / year
// CAS: 0 (not eligible)

export const SICK_DAYS_PER_MONTH = 1.5;   // full-time monthly accrual
export const FULL_TIME_HOURS_PER_MONTH = 162.5;
export const SICK_MAX_DAYS = 156;          // Art. 42.01(D) — 156 work days / 1170 hours

/**
 * Returns total annual sick leave entitlement in days for the given shift lines.
 * Each FT line contributes 18 days; each PT line contributes FTE × 18 days; CAS contributes 0.
 */
export function calculateSickLeaveEntitlement(shiftLines = []) {
  return shiftLines.reduce((total, line) => {
    if (line.status === 'full_time') return total + SICK_DAYS_PER_MONTH * 12;
    if (line.status === 'part_time') return total + (line.fte ?? 0) * SICK_DAYS_PER_MONTH * 12;
    return total; // casual
  }, 0);
}

/**
 * Returns a per-line breakdown for display purposes.
 * Each entry: { status, fte, days }
 */
export function sickLeaveBreakdown(shiftLines = []) {
  return shiftLines.map(line => {
    let days = 0;
    if (line.status === 'full_time') days = SICK_DAYS_PER_MONTH * 12;
    else if (line.status === 'part_time') days = (line.fte ?? 0) * SICK_DAYS_PER_MONTH * 12;
    return { status: line.status, fte: line.fte, days };
  });
}
