/**
 * NBA Collective Agreement Premium & Pay Calculator
 * Pure functions — no side effects, no API calls.
 */
import { VCH_PAY_PERIODS_2026 } from './statHolidays.js';

function round2(n) {
  return Math.round(n * 100) / 100;
}

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
  // Normalise overnight spans: if end < start, it crosses midnight — add 24 to end
  if (shiftStart >= shiftEnd) shiftEnd += 24;
  if (rangeStart >= rangeEnd) rangeEnd += 24;

  // A single overlap check on the normalised window covers all cases for 8–24h shifts
  const s1 = Math.max(shiftStart, rangeStart);
  const e1 = Math.min(shiftEnd, rangeEnd);
  return s1 < e1 ? e1 - s1 : 0;
}

/**
 * Returns the total clock hours spanned by the shift (including overnight)
 */
export function shiftSpanHours(startTime, endTime) {
  const start = parseTime(startTime);
  let end = parseTime(endTime);
  if (end <= start) end += 24; // overnight
  return end - start;
}

/**
 * Determine if a shift qualifies for evening premium (majority rule: >50% in 15:30–23:30)
 * Returns: 'full' (extended-hour: pay all paid hours), 'partial' (pay hours in window), or null
 */
export function eveningShiftType(startTime, endTime) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const span = shiftSpanHours(startTime, endTime);
  const eveningHrs = hoursInRange(start, end, 15.5, 23.5);
  const nightHrs = hoursInRange(start, end, 23.5, 31.5);
  if (eveningHrs <= nightHrs) return null;
  if (eveningHrs <= span / 2) return null;
  return 'full'; // majority in window → pay premium on ALL paid hours
}

export function nightShiftType(startTime, endTime) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const span = shiftSpanHours(startTime, endTime);
  const nightHrs = hoursInRange(start, end, 23.5, 31.5);
  const eveningHrs = hoursInRange(start, end, 15.5, 23.5);
  if (nightHrs <= eveningHrs) return null;
  if (nightHrs <= span / 2) return null;
  return 'full'; // majority in window → pay premium on ALL paid hours
}

export function isEveningShift(startTime, endTime) { return eveningShiftType(startTime, endTime) !== null; }
export function isNightShift(startTime, endTime) { return nightShiftType(startTime, endTime) !== null; }

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
 * Calculate weekend premium hours for a shift.
 * Weekend = every hour between Friday 23:00 and Sunday 23:00.
 * Handles overnight shifts by normalising end > 24.
 */
export function weekendHours(dateStr, startTime, endTime) {
  const start = parseTime(startTime);
  let end = parseTime(endTime);
  if (end <= start) end += 24; // overnight

  const dayOfWeek = new Date(dateStr + 'T12:00:00').getUTCDay(); // 0=Sun,5=Fri,6=Sat

  // Express the shift window relative to midnight of dateStr.
  // Weekend window expressed relative to same midnight:
  //   Friday (5):  23 → 47  (23:00 Fri to 23:00 Sun = +48h, capped at shift end)
  //   Saturday (6): 0 → 23  (all of Saturday) plus Sat-to-Sun overnight handled by overnight shift
  //   Sunday (0):   0 → 23  (midnight to 23:00 Sun)
  //   Any other day: only overnight portion can clip into Sat/Sun — handle via normalised window

  let total = 0;

  if (dayOfWeek === 5) {
    // Friday: weekend starts at 23:00
    // Shift may run into Sat (end > 24) — weekend is 23 to 23+24 = 47
    total += hoursInRange(start, end, 23, 47);
  } else if (dayOfWeek === 6) {
    // Saturday: entire day is weekend; overnight portion into Sun ends at 23 next day (23+24=47)
    total += hoursInRange(start, end, 0, 47);
    // cap at Sunday 23:00 = 23 hours into Sunday = Saturday 00 + 47
    total = Math.min(total, hoursInRange(start, end, 0, 47));
  } else if (dayOfWeek === 0) {
    // Sunday: weekend ends at 23:00 Sunday
    total += hoursInRange(start, end, 0, 23);
  }

  return Math.max(0, total);
}

/**
 * Calculate super shift premium hours.
 * Super shift = actual hours worked between:
 *   (a) Fri 23:30 – Sat 07:30
 *   (b) Sat 23:30 – Sun 07:30
 */
export function superShiftHours(dateStr, startTime, endTime) {
  const start = parseTime(startTime);
  let end = parseTime(endTime);
  if (end <= start) end += 24; // normalise overnight

  const dayOfWeek = new Date(dateStr + 'T12:00:00').getUTCDay(); // 0=Sun,5=Fri,6=Sat

  let total = 0;

  if (dayOfWeek === 5) {
    // Friday: super shift window is 23:30–31:30 (= Sat 07:30)
    total += hoursInRange(start, end, 23.5, 31.5);
  } else if (dayOfWeek === 6) {
    // Saturday: super shift window is 23:30–31:30 (= Sun 07:30)
    total += hoursInRange(start, end, 23.5, 31.5);
  }

  return Math.max(0, total);
}

/**
 * Calculate all applicable premiums for a single shift.
 * Returns amounts + the billed hours used for each premium (for display).
 * If shift.premium_overrides exists, those values are used instead of calculated ones.
 */
export function calculateShiftPremiums(shift, settings) {
  const rates = settings.premium_rates;
  const paidHours = shift.paid_hours || 0;
  const isStraight = ['regular', 'isn', 'vacation', 'sick', 'pdo_pst', 'other_leave'].includes(shift.shift_type);
  const overrides = shift.premium_overrides || {};

  // --- Evening / Night (mutually exclusive, majority-rule → all paid hours) ---
  const evType = eveningShiftType(shift.start_time, shift.end_time);
  const niType = nightShiftType(shift.start_time, shift.end_time);

  let eveningHrs = 0, nightHrs = 0;
  if (evType === 'full') {
    eveningHrs = paidHours;
  } else if (niType === 'full') {
    nightHrs = paidHours;
  }

  const wkndHrs = weekendHours(shift.date, shift.start_time, shift.end_time);
  const superHrs = superShiftHours(shift.date, shift.start_time, shift.end_time);

  // Build calculated values
  const calc = {
    evening:          round2(eveningHrs * rates.evening),
    evening_hours:    round2(eveningHrs),
    night:            round2(nightHrs * rates.night),
    night_hours:      round2(nightHrs),
    weekend:          round2(wkndHrs * rates.weekend),
    weekend_hours:    round2(wkndHrs),
    super_shift:      round2(superHrs * rates.super_shift),
    super_shift_hours:round2(superHrs),
    regular_premium:  isStraight ? round2(paidHours * rates.regular_premium) : 0,
    short_notice:     shift.short_notice ? round2(paidHours * rates.short_notice) : 0,
    responsibility:   shift.responsibility_pay === 'hourly'
                        ? round2(paidHours * rates.responsibility_hourly)
                        : shift.responsibility_pay === 'flat'
                          ? rates.responsibility_flat
                          : 0,
    preceptor:        shift.preceptor ? round2(paidHours * rates.preceptor) : 0,
  };

  // Apply any manual overrides
  return {
    ...calc,
    evening:         overrides.evening         != null ? overrides.evening         : calc.evening,
    night:           overrides.night           != null ? overrides.night           : calc.night,
    weekend:         overrides.weekend         != null ? overrides.weekend         : calc.weekend,
    super_shift:     overrides.super_shift     != null ? overrides.super_shift     : calc.super_shift,
    regular_premium: overrides.regular_premium != null ? overrides.regular_premium : calc.regular_premium,
    short_notice:    overrides.short_notice    != null ? overrides.short_notice    : calc.short_notice,
    responsibility:  overrides.responsibility  != null ? overrides.responsibility  : calc.responsibility,
    preceptor:       overrides.preceptor       != null ? overrides.preceptor       : calc.preceptor,
    _overridden: Object.keys(overrides).filter(k => overrides[k] != null),
  };
}

/**
 * Get the wage multiplier for a shift type (per-shift, per NBA CBA screenshot)
 * regular = ×1.0
 * day_off (working a day off) = ×2.0
 * work_stat (working a regular stat) = ×2.0
 * work_super_stat (working Good Friday / Labour Day / Christmas) = ×2.5
 * ot_stat (OT shift on any stat) = ×3.0
 * overtime = ×1.5
 * isn = ×1.0 (same base as regular, separate category)
 * vacation / sick / pdo_pst / other_leave = ×1.0
 */
export function getShiftMultiplier(shiftType) {
  switch (shiftType) {
    case 'day_off':         return 2.0;
    case 'work_stat':       return 2.0;
    case 'work_super_stat': return 2.5;
    case 'ot_stat':         return 3.0;
    case 'overtime':        return 1.5;
    default:                return 1.0;
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

  // Track overtime/stat hours by multiplier
  let otDetail = { 1.5: 0, 2: 0, 2.5: 0, 3: 0 };

  // Premium accumulators
  let eveningTotal = 0, nightTotal = 0, weekendTotal = 0, superShiftTotal = 0;
  let regularPremiumTotal = 0;
  let shortNoticeTotal = 0, responsibilityTotal = 0, preceptorTotal = 0;

  for (const shift of shifts) {
    const paidHours = shift.paid_hours || 0;
    const multiplier = getShiftMultiplier(shift.shift_type);
    const isStraight = ['regular', 'isn', 'vacation', 'sick', 'pdo_pst', 'other_leave'].includes(shift.shift_type);

    if (multiplier === 1.0) {
      straightTimePay += paidHours * wage;
      if (isStraight) regularHours += paidHours;
    } else {
      overtimePay += paidHours * wage * multiplier;
      otDetail[multiplier] = (otDetail[multiplier] || 0) + paidHours;
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
    overtime_detail: otDetail,
  };
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
 * Get the VCH bi-weekly pay period that contains today's date.
 * Falls back to a 14-day block calculation if no VCH period matches.
 */
export function getCurrentPayPeriodDates(refDate) {
  const today = (refDate ? new Date(refDate) : new Date()).toISOString().split('T')[0];
  const found = VCH_PAY_PERIODS_2026.find(p => today >= p.start && today <= p.end);
  if (found) {
    return { start_date: found.start, end_date: found.end };
  }
  // Fallback: 14-day blocks from a reference date
  const d = new Date(refDate || new Date());
  const reference = new Date('2026-01-02T12:00:00');
  const diffDays = Math.floor((d - reference) / (1000 * 60 * 60 * 24));
  const periodIndex = Math.floor(diffDays / 14);
  const start = new Date(reference);
  start.setDate(reference.getDate() + periodIndex * 14);
  const end = new Date(start);
  end.setDate(start.getDate() + 13);
  const fmt = (dt) => dt.toISOString().split('T')[0];
  return { start_date: fmt(start), end_date: fmt(end) };
}