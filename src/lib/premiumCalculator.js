/**
 * NBA Collective Agreement Premium & Pay Calculator
 * Pure functions — no side effects, no API calls.
 */
import { VCH_PAY_PERIODS_2026, getStatType } from './statHolidays.js';

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
  let h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  h = h % 24; // wrap hours ≥ 24 back to 00–23
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

export function isEveningShift(startTime, endTime) {
  if (shiftSpanHours(startTime, endTime) >= 10) {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    return hoursInRange(start, end, 15.5, 23.5) > 0;
  }
  return eveningShiftType(startTime, endTime) !== null;
}
export function isNightShift(startTime, endTime) {
  if (shiftSpanHours(startTime, endTime) >= 10) {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    return hoursInRange(start, end, 23.5, 31.5) > 0;
  }
  return nightShiftType(startTime, endTime) !== null;
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
  const isStraight = ['casual', 'regular', 'isn', 'vacation', 'paid_vacation', 'sick', 'paid_sick', 'special_leave', 'pdo_pst', 'other_leave'].includes(shift.shift_type);
  const overrides = shift.premium_overrides || {};

  // --- Evening / Night ---
  // Extended hour shifts (≥10h): pay premium only on hours within the window.
  // Both evening and night can apply simultaneously (different portions of the shift).
  // Regular shifts (<10h): majority rule — pick the dominant window, pay all paid hours.
  const shiftSpan = shiftSpanHours(shift.start_time, shift.end_time);
  const isExtended = shiftSpan >= 10;
  const start = parseTime(shift.start_time);
  const end = parseTime(shift.end_time);

  let eveningHrs = 0, nightHrs = 0;
  if (isExtended) {
    eveningHrs = hoursInRange(start, end, 15.5, 23.5);
    nightHrs = hoursInRange(start, end, 23.5, 31.5);
  } else {
    const evType = eveningShiftType(shift.start_time, shift.end_time);
    const niType = nightShiftType(shift.start_time, shift.end_time);
    if (evType === 'full') {
      eveningHrs = paidHours;
    } else if (niType === 'full') {
      nightHrs = paidHours;
    }
  }

  const wkndHrs = weekendHours(shift.date, shift.start_time, shift.end_time);
  const superHrs = superShiftHours(shift.date, shift.start_time, shift.end_time);

  // Cap time-window hours to paid hours (breaks don't earn premiums)
  const cap = (hrs) => Math.min(hrs, paidHours);
  eveningHrs = cap(eveningHrs);
  nightHrs = cap(nightHrs);
  const cappedWknd = cap(wkndHrs);
  const cappedSuper = cap(superHrs);

  // Build calculated values
  const calc = {
    evening:          round2(eveningHrs * rates.evening),
    evening_hours:    round2(eveningHrs),
    night:            round2(nightHrs * rates.night),
    night_hours:      round2(nightHrs),
    weekend:          round2(cappedWknd * rates.weekend),
    weekend_hours:    round2(cappedWknd),
    super_shift:      round2(cappedSuper * rates.super_shift),
    super_shift_hours:round2(cappedSuper),
    regular_premium:  isStraight ? round2(paidHours * rates.regular_premium) : 0,
    short_notice:     shift.short_notice ? round2(paidHours * rates.short_notice) : 0,
    responsibility:   shift.responsibility_pay === 'hourly'
                        ? round2(paidHours * rates.responsibility_hourly)
                        : shift.responsibility_pay === 'flat'
                          ? rates.responsibility_flat
                          : 0,
    preceptor:        shift.preceptor ? round2(paidHours * rates.preceptor) : 0,
    specialty:        shift.specialty_premium ? round2(paidHours * rates.specialty) : 0,
  };

  // Apply any manual overrides — hours are unaffected by dollar overrides
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
    specialty:       overrides.specialty       != null ? overrides.specialty       : calc.specialty,
    evening_hours:   calc.evening_hours,
    night_hours:     calc.night_hours,
    weekend_hours:   calc.weekend_hours,
    super_shift_hours: calc.super_shift_hours,
    regular_premium_hours: calc.regular_premium > 0 ? paidHours : 0,
    short_notice_hours: calc.short_notice > 0 ? paidHours : 0,
    responsibility_hours: shift.responsibility_pay === 'hourly' ? paidHours : (shift.responsibility_pay === 'flat' ? 1 : 0),
    preceptor_hours: calc.preceptor > 0 ? paidHours : 0,
    specialty_hours: calc.specialty > 0 ? paidHours : 0,
    _overridden: Object.keys(overrides).filter(k => overrides[k] != null),
  };
}

/**
 * Get the base wage multiplier for a shift type (before stat bumps).
 * casual / regular / isn / vacation / sick / special_leave / pdo_pst / other_leave = ×1.0
 * day_off = ×2.0 (working a day off)
 * unpaid_vacation / unpaid_sick = ×0 (no pay)
 */
export function getShiftMultiplier(shiftType) {
  switch (shiftType) {
    case 'day_off':          return 2.0;
    case 'unpaid_vacation':  return 0;
    case 'unpaid_sick':      return 0;
    default:                 return 1.0;
  }
}

/**
 * Split an overnight shift into per-date segments.
 * Non-overnight shifts return a single segment.
 * Each segment has { date, hours, range } where:
 *   - hours is the paid portion on that date (after break deduction)
 *   - range is the paid time range as "HH:MM–HH:MM"
 *
 * For shifts ≥5h, the unpaid break is placed at the 5-hour mark from shift start,
 * not proportionally divided. This ensures payroll-accurate segment hours.
 */
export function splitOvernightShift(shift) {
  const startH = parseTime(shift.start_time);
  let endH = parseTime(shift.end_time);
  const unpaidBreak = shift.unpaid_break || 0;

  // Not overnight — single segment
  if (endH > startH) {
    const hours = shift.paid_hours || (endH - startH - unpaidBreak);
    return [{ date: shift.date, hours: round2(hours), range: `${shift.start_time}–${shift.end_time}` }];
  }

  // Overnight: split at midnight (24.0)
  endH += 24;
  const beforeMidnightClock = 24 - startH;
  const afterMidnightClock = endH - 24;

  let beforePaid, afterPaid, seg1Range, seg2Range;

  if (unpaidBreak > 0 && (beforeMidnightClock + afterMidnightClock) >= 5) {
    // Break occurs at the 5-hour mark from shift start
    const breakStartH = startH + 5;
    const breakEndH = breakStartH + unpaidBreak;

    // How much of the break falls before midnight vs after midnight
    const breakBefore = Math.max(0, Math.min(breakEndH, 24) - breakStartH);
    const breakAfter = Math.max(0, breakEndH - Math.max(breakStartH, 24));

    beforePaid = round2(beforeMidnightClock - breakBefore);
    afterPaid = round2(afterMidnightClock - breakAfter);

    // Paid time range for segment 1 (before midnight)
    seg1Range = breakBefore > 0
      ? `${shift.start_time}–${formatTime(breakStartH)}`
      : `${shift.start_time}–00:00`;

    // Paid time range for segment 2 (after midnight)
    // Break sits at the start of this segment when it crosses midnight —
    // paid portion begins after the break ends
    seg2Range = breakAfter > 0
      ? `${formatTime(Math.max(breakEndH, 24))}–${shift.end_time}`
      : `00:00–${shift.end_time}`;
  } else {
    // No break (or shift <5h): proportional split of paid_hours
    const paidHours = shift.paid_hours || (beforeMidnightClock + afterMidnightClock);
    beforePaid = round2((beforeMidnightClock / (beforeMidnightClock + afterMidnightClock)) * paidHours);
    afterPaid = round2((afterMidnightClock / (beforeMidnightClock + afterMidnightClock)) * paidHours);
    seg1Range = `${shift.start_time}–00:00`;
    seg2Range = `00:00–${shift.end_time}`;
  }

  const nextDate = new Date(shift.date + 'T12:00:00');
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = nextDate.toISOString().slice(0, 10);

  return [
    { date: shift.date, hours: beforePaid, range: seg1Range },
    { date: nextDateStr, hours: afterPaid, range: seg2Range },
  ];
}

/**
 * Get the effective wage multiplier for a shift segment based on its date.
 * Auto-calculates stat/overtime rates without needing separate shift types:
 *  - day_off: 2× normally, 3× on any stat (replaces old "OT on Stat")
 *  - Straight types (casual, regular, isn, leave, etc.): ×1.0 normally, ×2.0/×2.5 on stat
 *  - Unpaid types: ×0 always
 */
export function getSegmentMultiplier(shiftType, segmentDate) {
  const baseMultiplier = getShiftMultiplier(shiftType);
  const statType = getStatType(segmentDate);

  // Unpaid types — no pay regardless of date
  if (baseMultiplier === 0) return 0;

  // Working Day Off: 2× normally, bumps to 3× on any stat (equivalent to old "OT on Stat")
  if (shiftType === 'day_off') {
    return statType ? 3.0 : 2.0;
  }

  // Straight-time types (casual, regular, isn, vacation, sick, paid types, leave):
  // bump to stat rate when segment lands on a stat
  const STRAIGHT = ['casual', 'regular', 'isn', 'vacation', 'paid_vacation', 'sick', 'paid_sick', 'special_leave', 'pdo_pst', 'other_leave'];
  if (STRAIGHT.includes(shiftType)) {
    if (statType === 'super_stat') return 2.5;
    if (statType === 'stat') return 2.0;
    return 1.0;
  }

  // Anything else: keep base multiplier
  return baseMultiplier;
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
 * Get the set of pay period start_dates that are the first period (earliest start_date)
 * in each calendar month containing at least one shift.
 */
export function getFirstPeriodsOfMonths(periods) {
  const monthFirstPeriod = new Map();
  for (const p of periods) {
    const shifts = p.shifts || [];
    for (const shift of shifts) {
      const monthKey = shift.date.substring(0, 7);
      const existing = monthFirstPeriod.get(monthKey);
      if (!existing || p.start_date < existing) {
        monthFirstPeriod.set(monthKey, p.start_date);
      }
    }
  }
  return new Set(monthFirstPeriod.values());
}

/**
 * Calculate monthly allowance pay for a given pay period.
 * Paid in full on the first pay period of each month that has shifts; zero otherwise.
 */
export function calculateAllowances(settings, isFirstOfMonth = false) {
  const active = settings.active_allowances || [];
  const rates = settings.allowance_rates || {};
  const monthlyTotal = active.reduce((sum, key) => sum + (rates[key] || 0), 0);
  return {
    monthly_total: monthlyTotal,
    per_period: isFirstOfMonth ? monthlyTotal : 0,
  };
}

/**
 * Calculate qualification differential pay for a given pay period.
 * Paid in full on the first pay period of each month that has shifts; zero otherwise.
 */
export function calculateQualificationPay(settings, isFirstOfMonth = false) {
  const active = settings.active_qualifications || [];
  const rates = settings.qualification_rates || {};
  const annualTotal = active.reduce((sum, key) => sum + (rates[key] || 0), 0) * 12;
  const hourlyRate = annualTotal / 1950;
  const monthlyTotal = annualTotal / 12;
  return {
    annual_total: annualTotal,
    hourly_rate: hourlyRate,
    period_total: isFirstOfMonth ? monthlyTotal : 0,
  };
}

/**
 * Full pay period breakdown
 */
export function calculatePeriodBreakdown(shifts, settings, isFirstOfMonth = false) {
  const wage = settings.hourly_wage || 0;

  let straightTimePay = 0;
  let overtimePay = 0;
  let regularHours = 0;

  // Track overtime/stat hours by shift type
  let otDetail = { overtime: 0, day_off: 0, work_stat: 0, work_super_stat: 0, ot_stat: 0 };

  // Premium accumulators (dollars + hours)
  let eveningTotal = 0, nightTotal = 0, weekendTotal = 0, superShiftTotal = 0;
  let eveningHours = 0, nightHours = 0, weekendHours = 0, superShiftHours = 0;
  let regularPremiumTotal = 0, regularPremiumHours = 0;
  let shortNoticeTotal = 0, shortNoticeHours = 0;
  let responsibilityTotal = 0, responsibilityHours = 0;
  let preceptorTotal = 0, preceptorHours = 0;
  let specialtyTotal = 0, specialtyHours = 0;

  const STRAIGHT_TYPES = ['casual', 'regular', 'isn', 'vacation', 'paid_vacation', 'sick', 'paid_sick', 'special_leave', 'pdo_pst', 'other_leave'];
  const REGULAR_PREMIUM_TYPES = ['casual', 'regular', 'isn'];

  for (const shift of shifts) {
    // Per-shift time-window premiums (evening/night/weekend/super_shift are time-based, not date-based)
    const premiums = calculateShiftPremiums(shift, settings);
    eveningTotal += premiums.evening;
    nightTotal += premiums.night;
    weekendTotal += premiums.weekend;
    superShiftTotal += premiums.super_shift;
    shortNoticeTotal += premiums.short_notice;
    responsibilityTotal += premiums.responsibility;
    preceptorTotal += premiums.preceptor;
    specialtyTotal += premiums.specialty;
    eveningHours += premiums.evening_hours || 0;
    nightHours += premiums.night_hours || 0;
    weekendHours += premiums.weekend_hours || 0;
    superShiftHours += premiums.super_shift_hours || 0;
    shortNoticeHours += premiums.short_notice_hours || 0;
    responsibilityHours += premiums.responsibility_hours || 0;
    preceptorHours += premiums.preceptor_hours || 0;
    specialtyHours += premiums.specialty_hours || 0;

    // Per-date segments: base pay and regular_premium depend on which day the hours land on
    const segments = splitOvernightShift(shift);
    let shiftStraightHours = 0;

    for (const seg of segments) {
      const segMultiplier = getSegmentMultiplier(shift.shift_type, seg.date);

      if (segMultiplier === 1.0) {
        straightTimePay += seg.hours * wage;
        shiftStraightHours += seg.hours;
        if (STRAIGHT_TYPES.includes(shift.shift_type)) regularHours += seg.hours;
      } else {
        overtimePay += seg.hours * wage * segMultiplier;
        // Track into otDetail by effective rate
        if (segMultiplier === 3.0) otDetail.ot_stat = (otDetail.ot_stat || 0) + seg.hours;
        else if (segMultiplier === 2.5) otDetail.work_super_stat = (otDetail.work_super_stat || 0) + seg.hours;
        else if (segMultiplier === 2.0) {
          if (getStatType(seg.date)) otDetail.work_stat = (otDetail.work_stat || 0) + seg.hours;
          else otDetail.day_off = (otDetail.day_off || 0) + seg.hours;
        }
        else if (segMultiplier === 1.5) otDetail.overtime = (otDetail.overtime || 0) + seg.hours;
      }
    }

    // Regular premium: only on hours that actually stayed at 1× (straight-time)
    const adjustedRegularPremium = shiftStraightHours > 0 && REGULAR_PREMIUM_TYPES.includes(shift.shift_type)
      ? round2(shiftStraightHours * settings.premium_rates.regular_premium)
      : 0;
    regularPremiumTotal += adjustedRegularPremium;
    if (adjustedRegularPremium > 0) regularPremiumHours += shiftStraightHours;
  }

  // On-call (treat per-period — proxy for monthly; handle month boundaries in dashboard)
  const onCall = calculateOnCallPay(shifts, settings);

  // Allowances (full monthly on first period of month, zero otherwise)
  const allowances = calculateAllowances(settings, isFirstOfMonth);

  // Qualification differential (full monthly on first period of month, zero otherwise)
  const qualification = calculateQualificationPay(settings, isFirstOfMonth);

  // Union dues: 2% of straight-time pay only
  const unionDues = straightTimePay * 0.02;

  // Gross pay
  const grossPay =
    straightTimePay +
    overtimePay +
    eveningTotal + nightTotal + weekendTotal + superShiftTotal +
    regularPremiumTotal +
    shortNoticeTotal + responsibilityTotal + preceptorTotal +
    specialtyTotal +
    onCall.total +
    allowances.per_period +
    qualification.period_total -
    unionDues;

  return {
    straight_time_pay: round2(straightTimePay),
    overtime_pay: round2(overtimePay),
    stat_pay: round2(overtimePay), // stat pay bundled into overtime pay per multiplier
    regular_premium_total: round2(regularPremiumTotal),
    regular_premium_hours: round2(regularPremiumHours),
    evening_premium_total: round2(eveningTotal),
    evening_premium_hours: round2(eveningHours),
    night_premium_total: round2(nightTotal),
    night_premium_hours: round2(nightHours),
    weekend_premium_total: round2(weekendTotal),
    weekend_premium_hours: round2(weekendHours),
    super_shift_premium_total: round2(superShiftTotal),
    super_shift_premium_hours: round2(superShiftHours),
    short_notice_total: round2(shortNoticeTotal),
    short_notice_hours: round2(shortNoticeHours),
    responsibility_total: round2(responsibilityTotal),
    responsibility_hours: round2(responsibilityHours),
    preceptor_total: round2(preceptorTotal),
    preceptor_hours: round2(preceptorHours),
    specialty_premium_total: round2(specialtyTotal),
    specialty_premium_hours: round2(specialtyHours),
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
  const shortOpts = { month: 'short', day: 'numeric' };
  const fullOpts = { month: 'short', day: 'numeric', year: 'numeric' };
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  if (startYear === endYear) {
    const s = start.toLocaleDateString('en-CA', shortOpts);
    const e = end.toLocaleDateString('en-CA', fullOpts);
    return `${s} – ${e}`;
  }
  const s = start.toLocaleDateString('en-CA', fullOpts);
  const e = end.toLocaleDateString('en-CA', fullOpts);
  return `${s} – ${e}`;
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
  return getPayPeriodForDate(refDate || new Date());
}

/**
 * Calculate the bi-weekly pay period (start_date, end_date) that contains the given date.
 */
export function getPayPeriodForDate(date) {
  const d = new Date(typeof date === 'string' ? date + 'T12:00:00' : date);
  const dateStr = d.toISOString().split('T')[0];

  // Check VCH periods first
  const found = VCH_PAY_PERIODS_2026.find(p => dateStr >= p.start && dateStr <= p.end);
  if (found) {
    return { start_date: found.start, end_date: found.end };
  }

  // Fallback: 14-day blocks from reference
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

/**
 * Check if a shift is a duplicate of an existing one:
 * same date, same start_time, and same end_time.
 * Returns true if a match is found in the existing shifts array.
 */
export function isDuplicateShift(existingShifts, newShift) {
  return existingShifts.some(s =>
    s.date === newShift.date &&
    s.start_time === newShift.start_time &&
    s.end_time === newShift.end_time
  );
}