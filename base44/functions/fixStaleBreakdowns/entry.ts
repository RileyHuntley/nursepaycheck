import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [settingsList, periods] = await Promise.all([
      base44.entities.Settings.list(),
      base44.entities.PayPeriod.list('-start_date', 100),
    ]);

    if (settingsList.length === 0) {
      return Response.json({ error: 'No settings found' }, { status: 400 });
    }

    const settings = settingsList[0];
    const premRates = settings.premium_rates || {};
    const otMultipliers = settings.ot_multipliers || {};
    const activeAllowances = settings.active_allowances || [];
    const allowanceRates = settings.allowance_rates || {};
    const activeQualifications = settings.active_qualifications || [];
    const qualRates = settings.qualification_rates || {};

    const fixed = [];

    for (const period of periods) {
      const shifts = period.shifts || [];
      if (shifts.length === 0) continue;

      const storedRegHours = period.breakdown?.regular_hours || 0;
      const actualRegHours = shifts
        .filter(s => ['regular', 'isn', 'vacation', 'sick', 'pdo_pst', 'other_leave'].includes(s.shift_type || ''))
        .reduce((sum, s) => sum + (s.paid_hours || 0), 0);

      if (Math.abs(storedRegHours - actualRegHours) < 0.5) continue;

      // Compute breakdown inline
      let straight_time_pay = 0, overtime_pay = 0, stat_pay = 0;
      let regPremHours = 0, evePremHours = 0, nightPremHours = 0, weekendPremHours = 0,
          superPremHours = 0, shortNoticeHours = 0, respHours = 0, respFlatCount = 0,
          preceptorHours = 0, onCallHours = 0;
      let regularHours = 0;
      const overtimeDetail = {};

      for (const shift of shifts) {
        const ph = shift.paid_hours || 0;
        const type = shift.shift_type || 'regular';
        const ov = shift.premium_overrides || {};
        const wage = getWageForDate(settings, shift.date);

        if (['regular', 'isn', 'vacation', 'sick', 'pdo_pst', 'other_leave'].includes(type)) {
          straight_time_pay += ph * wage;
          regularHours += ph;
        } else if (type === 'overtime') {
          overtime_pay += ph * wage * (otMultipliers.overtime || 1.5);
          overtimeDetail.overtime = (overtimeDetail.overtime || 0) + ph;
        } else if (type === 'day_off') {
          overtime_pay += ph * wage * (otMultipliers.overtime_extended || 2);
          overtimeDetail.day_off = (overtimeDetail.day_off || 0) + ph;
        } else if (type === 'work_stat') {
          straight_time_pay += ph * wage;
          stat_pay += ph * wage * (otMultipliers.stat_holiday || 1.5);
          overtimeDetail.work_stat = (overtimeDetail.work_stat || 0) + ph;
          regularHours += ph;
        } else if (type === 'work_super_stat') {
          straight_time_pay += ph * wage;
          stat_pay += ph * wage * (otMultipliers.ot_stat_holiday || 3);
          overtimeDetail.work_super_stat = (overtimeDetail.work_super_stat || 0) + ph;
          regularHours += ph;
        } else if (type === 'ot_stat') {
          overtime_pay += ph * wage * (otMultipliers.ot_stat_holiday || 3);
          overtimeDetail.ot_stat = (overtimeDetail.ot_stat || 0) + ph;
        }

        // Regular premium applies to all straight-time hours
        if (['regular', 'work_stat', 'work_super_stat', 'isn', 'vacation', 'sick', 'pdo_pst', 'other_leave'].includes(type)) {
          regPremHours += ph;
        }

        // Night/evening: majority rule based on start/end times
        if (shift.start_time && shift.end_time) {
          const stParts = shift.start_time.split(':').map(Number);
          const etParts = shift.end_time.split(':').map(Number);
          const stDec = stParts[0] + stParts[1] / 60;
          let etDec = etParts[0] + etParts[1] / 60;
          if (etDec <= stDec) etDec += 24;

          // Evening: > half hours between 15:30 and 23:30
          const eveStart = Math.max(stDec, 15.5);
          const eveEnd = Math.min(etDec, 23.5);
          const eveHours = Math.max(0, eveEnd - eveStart);
          // Night: > half hours between 23:30 and 07:30
          const nightStart1 = Math.max(stDec, 23.5);
          const nightEnd1 = Math.min(etDec, 31.5);
          const nightHours1 = Math.max(0, nightEnd1 - nightStart1);
          const nightStart2 = Math.max(stDec, 0);
          const nightEnd2 = Math.min(etDec, 7.5);
          const nightHours2 = Math.max(0, nightEnd2 - nightStart2);
          const nightHours = nightHours1 + nightHours2;

          if (eveHours > (etDec - stDec) / 2 && ov.evening == null) evePremHours += ph;
          else if (ov.evening != null) evePremHours += 0; // override handled separately

          if (nightHours > (etDec - stDec) / 2 && ov.night == null) nightPremHours += ph;
          else if (ov.night != null) nightPremHours += 0;

          // Weekend: hours between Friday 23:00 and Sunday 23:00
          const dow = new Date(shift.date + 'T12:00:00').getDay();
          if (ov.weekend == null) {
            if (dow === 5 && etDec > 23) {
              weekendPremHours += Math.min(ph, Math.max(0, etDec - 23));
            } else if (dow === 6) {
              weekendPremHours += ph;
            } else if (dow === 0 && stDec < 23) {
              weekendPremHours += Math.min(ph, Math.max(0, 23 - stDec));
            }
          }

          // Super shift: Friday 23:30-Sat 07:30 + Sat 23:30-Sun 07:30
          if (ov.super_shift == null) {
            if (dow === 5 && etDec > 23.5) superPremHours += Math.min(ph, Math.max(0, etDec - 23.5));
            else if (dow === 6 && stDec < 7.5) superPremHours += Math.min(ph, 7.5 - stDec);
            else if (dow === 6 && etDec > 23.5) superPremHours += Math.min(ph, Math.max(0, etDec - 23.5));
            else if (dow === 0 && stDec < 7.5) superPremHours += Math.min(ph, 7.5 - stDec);
          }
        }

        if (shift.short_notice && ov.short_notice == null) shortNoticeHours += ph;
        if (shift.responsibility_pay === 'hourly' && ov.responsibility == null) respHours += ph;
        if (shift.responsibility_pay === 'flat' && ov.responsibility == null) respFlatCount++;
        if (shift.preceptor && ov.preceptor == null) preceptorHours += ph;
        onCallHours += shift.on_call_hours || 0;
      }

      // Premium totals (use overrides if set)
      let responsibility_total = 0, short_notice_total = 0, preceptor_total = 0;
      for (const shift of shifts) {
        const ov = shift.premium_overrides || {};
        if (ov.responsibility != null) responsibility_total += ov.responsibility;
        if (ov.short_notice != null) short_notice_total += ov.short_notice;
        if (ov.preceptor != null) preceptor_total += ov.preceptor;
      }
      responsibility_total += respHours * (premRates.responsibility_hourly || 2.5) + respFlatCount * (premRates.responsibility_flat || 18.75);
      short_notice_total += shortNoticeHours * (premRates.short_notice || 2);
      preceptor_total += preceptorHours * (premRates.preceptor || 1.5);

      // On-call: first 72 in month at lower rate, rest at higher
      const shiftMonthKey = shifts[0]?.date?.slice(0, 7) || '';
      const monthlyOnCall = onCallHours;
      const first72 = Math.min(monthlyOnCall, 72);
      const beyond72 = Math.max(0, monthlyOnCall - 72);
      const on_call_total = first72 * (premRates.on_call_first_72 || 7) + beyond72 * (premRates.on_call_beyond_72 || 7.5);

      // Allowances: monthly × 12 / 26
      let allowance_total = 0;
      for (const a of activeAllowances) {
        allowance_total += ((allowanceRates[a] || 0) * 12) / 26;
      }

      // Qualifications: sum yearly, divide by 1950, multiply by regular hours
      let qualAnnual = 0;
      for (const q of activeQualifications) {
        qualAnnual += qualRates[q] || 0;
      }
      const qualHourly = qualAnnual / 1950;
      const qualification_total = qualHourly * regularHours;

      const union_dues = straight_time_pay * 0.02;

      const gross_pay = straight_time_pay + overtime_pay + stat_pay
        + (regPremHours * (premRates.regular_premium || 2.15))
        + (evePremHours * (premRates.evening || 1.4))
        + (nightPremHours * (premRates.night || 5))
        + (weekendPremHours * (premRates.weekend || 3.5))
        + (superPremHours * (premRates.super_shift || 1.85))
        + short_notice_total + responsibility_total + preceptor_total
        + on_call_total + allowance_total + qualification_total;

      const breakdown = {
        straight_time_pay,
        overtime_pay,
        stat_pay,
        regular_premium_total: regPremHours * (premRates.regular_premium || 2.15),
        regular_premium_hours: regPremHours,
        evening_premium_total: evePremHours * (premRates.evening || 1.4),
        evening_premium_hours: evePremHours,
        night_premium_total: nightPremHours * (premRates.night || 5),
        night_premium_hours: nightPremHours,
        weekend_premium_total: weekendPremHours * (premRates.weekend || 3.5),
        weekend_premium_hours: weekendPremHours,
        super_shift_premium_total: superPremHours * (premRates.super_shift || 1.85),
        super_shift_premium_hours: superPremHours,
        short_notice_total,
        short_notice_hours: shortNoticeHours,
        responsibility_total,
        responsibility_hours: respHours + respFlatCount,
        preceptor_total,
        preceptor_hours: preceptorHours,
        on_call_total,
        on_call_hours: onCallHours,
        allowance_total,
        allowance_monthly: activeAllowances.reduce((s, a) => s + (allowanceRates[a] || 0), 0),
        qualification_total,
        qualification_annual: qualAnnual,
        qualification_hourly: qualHourly,
        union_dues,
        gross_pay,
        regular_hours: regularHours,
        overtime_detail: Object.keys(overtimeDetail).length > 0 ? overtimeDetail : null,
      };

      await base44.entities.PayPeriod.update(period.id, { breakdown });

      fixed.push({
        id: period.id,
        name: period.name,
        shifts: shifts.length,
        oldGross: period.breakdown?.gross_pay || 0,
        newGross: gross_pay,
      });
    }

    return Response.json({ fixed: fixed.length, details: fixed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});