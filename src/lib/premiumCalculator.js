/**
 * NBA Collective Agreement Premium & Pay Calculator
 * Pure functions — no side effects, no API calls.
 */

/**
 * Parse time string "HH:MM" or "HH.MM" to decimal hours (e.g. "15:30" → 15.5)
 */
export function parseTime(timeStr) {
  if (!timeStr) return 0;
  const cleaned = timeStr.replace('.', ':');
  const [h, m] = cleaned.split(':').map(Number);
  return h + (m || 0) / 60;
}

/**
 * Format decimal hours back to "HH:MM"
 */
export function formatTime(decimal) {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculate overlap hours between [shiftStart, shiftEnd] and [rangeStart, rangeEnd]
 * All values in decimal hours (0-24+). Handles overnight shifts.
 */
export function hoursInRange(shiftStart, shiftEnd, rangeStart, rangeEnd) {
  if (shiftStart >= shiftEnd) shiftEnd += 24; // overnight shift
  if (rangeStart >= rangeEnd) rangeEnd += 24;

  // Check overlap in 24h window, then shift and check again for overnight
  let total = 0;

  // Normal window
  const s1 = Math.max(shiftStart, rangeStart);
  const e1 = Math.min(shiftEnd, rangeEnd);
  if (s1 < e1) total += e1 - s1;

  // Overnight window (shift everything by +24)
  const s2 = Math.max(shiftStart + 24, rangeStart);
  const e2 = Math.min(shiftEnd + 24, rangeEnd + 24);
  if (s2 < e2) total += e2 - s2;

  return total;
}

/**
 * Determine if a shift is evening (majority of hours between 15:30–23:30)
 */
export function isEveningShift(startTime, endTime) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const totalHours = end > start ? end - start : end + 24 - start;
  const eveningHours = hoursInRange(start, end, 15.5, 23.5);
  const nightHours = hoursInRange(start, end, 23.5, 7.5);
  return eveningHours > nightHours && eveningHours > totalHours / 2;
}

/**
 * Determine if a shift is night (majority of hours between 23:30–07:30)
 */
export function isNightShift(startTime, endTime) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const totalHours = end > start ? end - start : end + 24 - start;
  const eveningHours = hoursInRange(start, end, 15.5, 23.5);
  const nightHours = hoursInRange(start, end, 23.5, 7.5);
  return nightHours > eveningHours && nightHours > totalHours / 2;
}

/**
 * Check if a date falls on a weekend (Saturday or Sunday)
 */
export function isWeekendDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getUTCDay();
  return day === 0 || day === 6; // 0=Sun, 6=Sat
}

/**
 * Check if a day is Friday (for weekend boundary calculations)
 */
export function isFriday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getUTCDay() === 5;
}

/**
 * Check if a day is Saturday
 */
export function isSaturday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getUTCDay() === 6;
}

/**
 * Calculate weekend premium hours for a shift
 * Weekend = Friday 23:00 to Sunday 23:00
 */
export function weekendHours(dateStr, startTime, endTime) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (end <= start) return 0; // no overnight

  let weekendHrs = 0;

  if (isFriday(dateStr)) {
    // Friday: from 23:00 to end (or midnight if end > 24)
    weekendHrs += hoursInRange(start, Math.min(end, 24), 23, 24);
  }
  if (isSaturday(dateStr)) {
    // Saturday: whole shift is weekend
    weekendHrs += hoursInRange(start, end, 0, 24);
  }
  if (isWeekendDay(dateStr) && !isSaturday(dateStr)) {
    // Sunday: from start to 23:00
    weekendHrs += hoursInRange(start, end, 0, 23);
  }

  // Check Friday overnight into Saturday
  if (isFriday(dateStr) && end > 24) {
    // Overnight portion into Saturday is all weekend
    weekendHrs += (end - 24);
  }

  return weekendHrs;
}

/**
 * Calculate super shift premium hours
 * Super shift = Fri 23:30–Sat 07:30 OR Sat 23:30–Sun 07:30
 */
export function superShiftHours(dateStr, startTime, endTime) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (end <= start) return 0;

  let total = 0;

  // Friday overnight into Saturday: 23:30–07:30
  if (isFriday(dateStr)) {
    total += hoursInRange(start, Math.min(end, 24), 23.5, 24);
    if (end > 24) {
      total += Math.min(end - 24, 7.5);
    }
  }

  // Saturday overnight into Sunday: 23:30–07:30
  if (isSaturday(dateStr)) {
    total += hoursInRange(start, Math.min(end, 24), 23.5, 24);
    if (end > 24) {
      total += Math.min(end - 24, 7.5);
    }
  }

  return total;
}

/**
 * Calculate all applicable premiums for a single shift
 * Returns breakdown object with premium amounts
 */
export function calculateShiftPremiums(shift, settings) {
  const rates = settings.premium_rates;
  const paidHours = shift.paid_hours || 0;
  const isOT = ['overtime', 'overtime_extended', 'stat_holiday', 'ot_stat_holiday'].includes(shift.shift_type);
  const isStraight = ['regular', 'vacation', 'sick', 'other_leave'].includes(shift.shift_type);

  const result = {
    evening: 0,
    night: 0,
    weekend: 0,
    super_shift: 0,
    regular_premium: 0,
    short_notice: 0,
    responsibility: 0,
    preceptor: 0,
  };

  // Evening vs Night (mutually exclusive, majority rule)
  if (isEveningShift(shift.start_time, shift.end_time)) {
    result.evening = paidHours * rates.evening;
  } else if (isNightShift(shift.start_time, shift.end_time)) {
    result.night = paidHours * rates.night;
  }

  // Weekend Premium (per hour in weekend window)
  const wkndHrs = weekendHours(shift.date, shift.start_time, shift.end_time);
  if (wkndHrs > 0) {
    result.weekend = wkndHrs * rates.weekend;
  }

  // Super Shift Premium
  const superHrs = superShiftHours(shift.date, shift.start_time, shift.end_time);
  if (superHrs > 0) {
    result.super_shift = superHrs * rates.super_shift;
  }

  // Regular Premium — straight-time shifts only (not OT/stat)
  if (isStraight) {
    result.regular_premium = paidHours * rates.regular_premium;
  }

  // Short Notice
  if (shift.short_notice) {
    result.short_notice = paidHours * rates.short_notice;
  }

  // Responsibility Pay
  if (shift.responsibility_pay === 'hourly') {
    result.responsibility = paidHours * rates.responsibility_hourly;
  } else if (shift.responsibility_pay === 'flat') {
    result.responsibility = rates.responsibility_flat;
  }

  // Preceptor
  if (shift.preceptor) {
    result.preceptor = paidHours * rates.preceptor;
  }

  return result;
}

/**
 * Get the wage multiplier for a shift type
 */
export function getShiftMultiplier(shiftType, settings) {
  const multipliers = settings.ot_multipliers;
  switch (shiftType) {
    case 'overtime': return multipliers.overtime || 1.5;
    case 'overtime_extended': return multipliers.overtime_extended || 2.0;
    case 'stat_holiday': return multipliers.stat_holiday || 1.5;
    case 'ot_stat_holiday': return multipliers.ot_stat_holiday || 3.0;
    default: return 1.0;
  }
}

/**
 * Calculate on-call pay for a list of shifts within a given month
 * $7.00/hr first 72 hours, $7.50/hr beyond 72
 */
export function calculateOnCallPay(shifts, settings) {
  const rates = settings.premium_rates;
  const totalOnCallHours = shifts.reduce((sum, s) => sum + (s.on_call_hours || 0), 0);
  if (totalOnCallHours <= 0) return { total: 0, hours: 0 };

  const firstTier = Math.min(totalOnCallHours, 72);
  const secondTier = Math.max(0, totalOnCallHours - 72);
  return {
    hours: totalOnCallHours,
    total: firstTier * rates.on_call_first_72 + secondTier * rates.on_call_beyond_72,
  };
}

/**
 * Calculate monthly allowance total per pay period
 * Monthly allowance × 12 months ÷ 26 pay periods
 */
export function calculateAllowances(settings) {
  const active = settings.active_allowances || [];
  const rates = settings.allowance_rates || {};
  const monthlyTotal = active.reduce((sum, key) => sum + (rates[key] || 0), 0);
  return {
    monthly_total: monthlyTotal,
    per_period: monthlyTotal * 12 / 26,
  };
}

/**
 * Calculate qualification differential per pay period
 * Formula: (total annual differential ÷ 1950) × regular hours paid in period
 */
export function calculateQualificationPay(regularHoursInPeriod, settings) {
  const active = settings.active_qualifications || [];
  const rates = settings.qualification_rates || {};
  const annualTotal = active.reduce((sum, key) => sum + (rates[key] || 0), 0) * 12;
  const hourlyRate = annualTotal / 1950;
  return {
    annual_total: annualTotal,
    hourly_rate: hourlyRate,
    period_total: hourlyRate * regularHoursInPeriod,
  };
}

/**
 * Full pay period breakdown
 */
export function calculatePeriodBreakdown(shifts, settings) {
  const wage = settings.hourly_wage || 0;

  let straightTimePay = 0;
  let overtimePay = 0;
  let regularHours = 0;

  // Premium accumulators
  let eveningTotal = 0, nightTotal = 0, weekendTotal = 0, superShiftTotal = 0;
  let regularPremiumTotal = 0;
  let shortNoticeTotal = 0, responsibilityTotal = 0, preceptorTotal = 0;

  for (const shift of shifts) {
    const paidHours = shift.paid_hours || 0;
    const multiplier = getShiftMultiplier(shift.shift_type, settings);
    const isStraight = ['regular', 'vacation', 'sick', 'other_leave'].includes(shift.shift_type);

    if (multiplier === 1.0) {
      straightTimePay += paidHours * wage;
      if (isStraight) regularHours += paidHours;
    } else {
      overtimePay += paidHours * wage * multiplier;
    }

    const premiums = calculateShiftPremiums(shift, settings);
    eveningTotal += premiums.evening;
    nightTotal += premiums.night;
    weekendTotal += premiums.weekend;
    superShiftTotal += premiums.super_shift;
    regularPremiumTotal += premiums.regular_premium;
    shortNoticeTotal += premiums.short_notice;
    responsibilityTotal += premiums.responsibility;
    preceptorTotal += premiums.preceptor;
  }

  // On-call (treat per-period — proxy for monthly; handle month boundaries in dashboard)
  const onCall = calculateOnCallPay(shifts, settings);

  // Allowances
  const allowances = calculateAllowances(settings);

  // Qualification differential
  const qualification = calculateQualificationPay(regularHours, settings);

  // Union dues: 2% of straight-time pay only
  const unionDues = straightTimePay * 0.02;

  // Gross pay
  const grossPay =
    straightTimePay +
    overtimePay +
    eveningTotal + nightTotal + weekendTotal + superShiftTotal +
    regularPremiumTotal +
    shortNoticeTotal + responsibilityTotal + preceptorTotal +
    onCall.total +
    allowances.per_period +
    qualification.period_total -
    unionDues;

  return {
    straight_time_pay: round2(straightTimePay),
    overtime_pay: round2(overtimePay),
    stat_pay: round2(overtimePay), // stat pay bundled into overtime pay per multiplier
    regular_premium_total: round2(regularPremiumTotal),
    evening_premium_total: round2(eveningTotal),
    night_premium_total: round2(nightTotal),
    weekend_premium_total: round2(weekendTotal),
    super_shift_premium_total: round2(superShiftTotal),
    short_notice_total: round2(shortNoticeTotal),
    responsibility_total: round2(responsibilityTotal),
    preceptor_total: round2(preceptorTotal),
    on_call_total: round2(onCall.total),
    on_call_hours: onCall.hours,
    allowance_total: round2(allowances.per_period),
    allowance_monthly: allowances.monthly_total,
    qualification_total: round2(qualification.period_total),
    qualification_annual: qualification.annual_total,
    qualification_hourly: round2(qualification.hourly_rate),
    union_dues: round2(unionDues),
    gross_pay: round2(grossPay),
    regular_hours: regularHours,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Generate bi-weekly pay period name from dates
 */
export function getPayPeriodName(startDate, endDate) {
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  const opts = { month: 'short', day: 'numeric' };
  const s = start.toLocaleDateString('en-CA', opts);
  const e = end.toLocaleDateString('en-CA', opts);
  return `PP: ${s} – ${e}`;
}

/**
 * Get the bi-weekly period that contains a given date (for finding current period)
 */
export function getCurrentPayPeriodDates(refDate) {
  const d = new Date(refDate || new Date());
  // Find the Monday of the current or previous bi-weekly period
  // Simple approach: use 14-day blocks from a reference Monday
  const reference = new Date('2026-01-05T12:00:00'); // A known Monday
  const diffDays = Math.floor((d - reference) / (1000 * 60 * 60 * 24));
  const periodIndex = Math.floor(diffDays / 14);
  const start = new Date(reference);
  start.setDate(reference.getDate() + periodIndex * 14);
  const end = new Date(start);
  end.setDate(start.getDate() + 13);

  const fmt = (dt) => dt.toISOString().split('T')[0];
  return { start_date: fmt(start), end_date: fmt(end) };
}