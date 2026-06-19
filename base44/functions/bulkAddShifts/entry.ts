import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Inline premium calculator helpers (avoiding large frontend lib import)
function getWageForDate(settings, date) {
  const history = settings.wage_history;
  if (!history || history.length === 0) return settings.hourly_wage || 45;
  const sorted = [...history]
    .filter(e => e.wage > 0)
    .sort((a, b) => (b.effective_date || '') > (a.effective_date || '') ? 1 : -1)
    .reverse();
  if (!date) return sorted[0]?.wage || settings.hourly_wage || 45;
  for (const entry of sorted) {
    if (!entry.effective_date || entry.effective_date <= date) return entry.wage;
  }
  return sorted[sorted.length - 1]?.wage || settings.hourly_wage || 45;
}

function calculatePeriodBreakdown(shifts, settings) {
  const otMult = settings.ot_multipliers || {};
  const premRates = settings.premium_rates || {};

  let straightTimePay = 0, overtimePay = 0, statPay = 0;
  let regularPremiumTotal = 0, eveningPremiumTotal = 0, nightPremiumTotal = 0;
  let weekendPremiumTotal = 0, superShiftPremiumTotal = 0;
  let specialtyPremiumTotal = 0, specialtyPremiumHours = 0;
  let shortNoticeTotal = 0, responsibilityTotal = 0, preceptorTotal = 0;
  let onCallTotal = 0, onCallHours = 0;
  let regularHours = 0;

  for (const shift of (shifts || [])) {
    const hours = shift.paid_hours || 0;
    if (hours <= 0) continue;
    const wage = getWageForDate(settings, shift.date);
    const startH = parseInt((shift.start_time || '07:00').split(':')[0]);
    const endH_raw = parseInt((shift.end_time || '19:00').split(':')[0]);
    const endH = endH_raw <= startH ? endH_raw + 24 : endH_raw;

    // Evening premium: 15:00-23:00
    const eveningHrs = Math.max(0, Math.min(endH, 23) - Math.max(startH, 15));
    // Night premium: 23:00-07:00
    const nightHrs = Math.max(0, Math.min(endH, 31) - Math.max(startH, 23)) + Math.max(0, Math.min(endH - 24, 7) - Math.max(startH - 24, 0));
    eveningPremiumTotal += eveningHrs * (premRates.evening || 1.4);
    nightPremiumTotal += nightHrs * (premRates.night || 5);

    // Weekend premium
    const d = new Date(shift.date + 'T12:00:00');
    const day = d.getDay();
    if (day === 0 || day === 6) {
      weekendPremiumTotal += hours * (premRates.weekend || 3.5);
    }

    // Stat holiday check
    const isStat = isStatHoliday(shift.date);
    if (isStat === 'super_stat') {
      superShiftPremiumTotal += hours * (premRates.super_shift || 1.85);
      statPay += hours * wage * (otMult.stat_holiday || 1.5);
    } else if (isStat === 'stat') {
      statPay += hours * wage * (otMult.stat_holiday || 1.5);
    }

    // Regular premium
    regularPremiumTotal += hours * (premRates.regular_premium || 2.15);

    // Base pay
    const isOT = shift.shift_type === 'overtime' || shift.shift_type === 'ot_stat';
    const isExt = shift.extended_shift;

    if (isOT) {
      overtimePay += hours * wage * (otMult.overtime || 1.5);
    } else {
      straightTimePay += hours * wage;
      regularHours += hours;
    }
    if (isExt) {
      overtimePay += hours * wage * ((otMult.overtime_extended || 2) - 1);
    }

    // Specialty
    if (shift.specialty_premium) {
      specialtyPremiumHours += hours;
      specialtyPremiumTotal += hours * (premRates.specialty || 2);
    }

    // Short notice
    if (shift.short_notice) {
      shortNoticeTotal += hours * (premRates.short_notice || 2);
    }

    // Responsibility
    if (shift.responsibility_pay === 'hourly') {
      responsibilityTotal += hours * (premRates.responsibility_hourly || 2.5);
    } else if (shift.responsibility_pay === 'flat') {
      responsibilityTotal += (premRates.responsibility_flat || 18.75);
    }

    // Preceptor
    if (shift.preceptor) {
      preceptorTotal += hours * (premRates.preceptor || 1.5);
    }

    // On-call
    const ocHours = shift.on_call_hours || 0;
    if (ocHours > 0) {
      onCallHours += ocHours;
      onCallTotal += ocHours <= 72
        ? ocHours * (premRates.on_call_first_72 || 7)
        : 72 * (premRates.on_call_first_72 || 7) + (ocHours - 72) * (premRates.on_call_beyond_72 || 7.5);
    }

    // Allowances / qualifications are per-period, handled separately
  }

  const allowanceTotal = 0; // computed per-month separately
  const qualificationTotal = 0;

  const grossPay = straightTimePay + overtimePay + statPay + regularPremiumTotal +
    eveningPremiumTotal + nightPremiumTotal + weekendPremiumTotal +
    superShiftPremiumTotal + specialtyPremiumTotal + shortNoticeTotal +
    responsibilityTotal + preceptorTotal + onCallTotal;

  return {
    straight_time_pay: Math.round(straightTimePay * 100) / 100,
    overtime_pay: Math.round(overtimePay * 100) / 100,
    stat_pay: Math.round(statPay * 100) / 100,
    regular_premium_total: Math.round(regularPremiumTotal * 100) / 100,
    evening_premium_total: Math.round(eveningPremiumTotal * 100) / 100,
    night_premium_total: Math.round(nightPremiumTotal * 100) / 100,
    weekend_premium_total: Math.round(weekendPremiumTotal * 100) / 100,
    super_shift_premium_total: Math.round(superShiftPremiumTotal * 100) / 100,
    specialty_premium_total: Math.round(specialtyPremiumTotal * 100) / 100,
    specialty_premium_hours: specialtyPremiumHours,
    short_notice_total: Math.round(shortNoticeTotal * 100) / 100,
    responsibility_total: Math.round(responsibilityTotal * 100) / 100,
    preceptor_total: Math.round(preceptorTotal * 100) / 100,
    on_call_total: Math.round(onCallTotal * 100) / 100,
    on_call_hours: onCallHours,
    allowance_total: allowanceTotal,
    allowance_monthly: 0,
    qualification_total: qualificationTotal,
    qualification_annual: 0,
    qualification_hourly: 0,
    union_dues: Math.round(grossPay * 0.0185 * 100) / 100,
    gross_pay: Math.round(grossPay * 100) / 100,
    regular_hours: regularHours,
  };
}

function isStatHoliday(dateStr) {
  const statDays = {
    '2026-01-01': 'stat', '2026-04-03': 'stat', '2026-04-05': 'super_stat',
    '2026-05-18': 'stat', '2026-07-01': 'stat', '2026-08-03': 'stat',
    '2026-09-07': 'stat', '2026-10-12': 'stat', '2026-11-11': 'stat',
    '2026-12-25': 'stat', '2026-12-26': 'stat',
    '2025-01-01': 'stat', '2025-04-18': 'stat', '2025-04-20': 'super_stat',
    '2025-05-19': 'stat', '2025-07-01': 'stat', '2025-08-04': 'stat',
    '2025-09-01': 'stat', '2025-10-13': 'stat', '2025-11-11': 'stat',
    '2025-12-25': 'stat', '2025-12-26': 'stat',
  };
  return statDays[dateStr] || null;
}

function getPayPeriodForDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = d.getDay();
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + daysToSunday);
  const sundayStr = sunday.toISOString().split('T')[0];

  const endDate = new Date(sunday);
  endDate.setDate(sunday.getDate() + 13);
  const endDateStr = endDate.toISOString().split('T')[0];

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 13);
  const startDateStr = startDate.toISOString().split('T')[0];

  return { start_date: startDateStr, end_date: endDateStr };
}

function getPayPeriodName(start, end) {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  return `${s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function isDuplicate(existingShifts, newShift) {
  return existingShifts.some(s =>
    s.date === newShift.date &&
    s.start_time === newShift.start_time &&
    s.end_time === newShift.end_time
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { shifts: incomingShifts, settings } = await req.json();
    if (!Array.isArray(incomingShifts) || incomingShifts.length === 0) {
      return Response.json({ error: 'No shifts provided' }, { status: 400 });
    }

    // Filter out shifts before 2025
    const shifts = incomingShifts.filter(s => s.date >= '2025-01-01');
    if (shifts.length === 0) {
      return Response.json({ added: 0, skipped: incomingShifts.length, periods: 0 });
    }

    // Fetch all existing periods
    const allPeriods = await base44.asServiceRole.entities.PayPeriod.list('-start_date', 50);

    // Group shifts by period
    const groups = {};
    for (const s of shifts) {
      const { start_date, end_date } = getPayPeriodForDate(s.date);
      const key = `${start_date}|${end_date}`;
      if (!groups[key]) {
        groups[key] = { start_date, end_date, shifts: [] };
      }
      groups[key].shifts.push(s);
    }

    let totalAdded = 0;
    let totalSkipped = 0;
    let periodCount = 0;

    // Process each period sequentially
    for (const [key, group] of Object.entries(groups)) {
      const existing = allPeriods.find(p => p.start_date === group.start_date && p.end_date === group.end_date);
      let period;

      if (existing) {
        period = existing;
      } else {
        period = await base44.asServiceRole.entities.PayPeriod.create({
          name: getPayPeriodName(group.start_date, group.end_date),
          start_date: group.start_date,
          end_date: group.end_date,
          shifts: [],
        });
        allPeriods.push(period);
      }

      const existingShifts = period.shifts || [];
      const newShifts = group.shifts.filter(s => !isDuplicate(existingShifts, s));
      totalSkipped += group.shifts.length - newShifts.length;

      if (newShifts.length === 0) continue;

      const mergedShifts = [...existingShifts, ...newShifts];
      const breakdown = calculatePeriodBreakdown(mergedShifts, settings);

      await base44.asServiceRole.entities.PayPeriod.update(period.id, {
        shifts: mergedShifts,
        breakdown,
      });

      totalAdded += newShifts.length;
      periodCount++;
    }

    return Response.json({
      added: totalAdded,
      skipped: totalSkipped,
      periods: periodCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});