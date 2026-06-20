import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { getCurrentPayPeriodDates, parseTime, calculateShiftPremiums } from '@/lib/premiumCalculator';
import { getStatType } from '@/lib/statHolidays';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Date helpers ──────────────────────────────────────────────────────────────

const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const monthStart = (y, m) => new Date(y, m, 1).toISOString().split('T')[0];
const monthEnd   = (y, m) => new Date(y, m + 1, 0).toISOString().split('T')[0];

const fmtHours = (h) => {
  if (h == null || isNaN(h) || h === 0) return h === 0 ? '0h' : '—';
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
};

const ppFmt = (d) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

// ── OT calculation (per NBA CBA) ─────────────────────────────────────────────
// Straight time = first 7.5 h of each shift on a regular day
// OT/stat       = hours beyond 7.5 h/shift + all hours on stat/super-stat days
//               + all hours on day_off shifts (2× premium regardless)
const UNPAID_TYPES = ['unpaid_vacation', 'unpaid_sick', 'student_practicum'];

function classifyShiftHours(shift) {
  const hours = shift.paid_hours || 0;
  if (hours <= 0 || UNPAID_TYPES.includes(shift.shift_type)) {
    return { straight: 0, overtime: 0 };
  }
  // Day off worked → all hours are OT-rated
  if (shift.shift_type === 'day_off') {
    return { straight: 0, overtime: hours };
  }
  // Stat / super-stat holiday → all hours at elevated multiplier
  if (getStatType(shift.date)) {
    return { straight: 0, overtime: hours };
  }
  // All other shifts (including 12 h regular/orientation shifts) are straight time
  return { straight: hours, overtime: 0 };
}

function getHoursForShifts(shifts, minDate, maxDate) {
  const filtered = shifts.filter(
    s => (s.paid_hours || 0) > 0 &&
      (!minDate || s.date >= minDate) &&
      (!maxDate || s.date <= maxDate) &&
      !UNPAID_TYPES.includes(s.shift_type)
  );
  if (filtered.length === 0) return { total: 0, straight: 0, overtime: 0, shiftCount: 0 };

  let straight = 0, overtime = 0;
  for (const s of filtered) {
    const c = classifyShiftHours(s);
    straight += c.straight;
    overtime += c.overtime;
  }
  return {
    total: straight + overtime,
    straight,
    overtime,
    shiftCount: filtered.length,
  };
}

// ── Shift-pattern breakdowns ──────────────────────────────────────────────────

// Day shift = starts before 15:30 (evening window start); night = 15:30 or later
function isNightShift(shift) {
  if (!shift.start_time) return false;
  return parseTime(shift.start_time) >= 15.5;
}

function isWeekend(dateStr) {
  const day = new Date(dateStr + 'T12:00:00').getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Premium labels shown in the visualization
const PREMIUM_DEFS = [
  { key: 'evening',      label: 'Evening',       hoursKey: 'evening_hours',       color: 'bg-sky-500' },
  { key: 'night',        label: 'Night',          hoursKey: 'night_hours',         color: 'bg-indigo-500' },
  { key: 'weekend',      label: 'Weekend',        hoursKey: 'weekend_hours',       color: 'bg-violet-500' },
  { key: 'super_shift',  label: 'Super Shift',    hoursKey: 'super_shift_hours',   color: 'bg-rose-500' },
  { key: 'short_notice', label: 'Short Notice',   hoursKey: 'short_notice_hours',  color: 'bg-orange-500' },
  { key: 'responsibility', label: 'Responsibility', hoursKey: 'responsibility_hours', color: 'bg-amber-500' },
  { key: 'preceptor',    label: 'Preceptor',      hoursKey: 'preceptor_hours',     color: 'bg-teal-500' },
  { key: 'specialty',    label: 'Specialty',      hoursKey: 'specialty_hours',     color: 'bg-emerald-500' },
];

function buildPremiumBreakdown(shifts, minDate, maxDate, settings) {
  if (!settings) return null;
  const filtered = shifts.filter(
    s => (s.paid_hours || 0) > 0 &&
      !UNPAID_TYPES.includes(s.shift_type) &&
      (!minDate || s.date >= minDate) &&
      (!maxDate || s.date <= maxDate)
  );
  if (filtered.length === 0) return null;

  const totals = {};
  PREMIUM_DEFS.forEach(p => { totals[p.key] = { hours: 0, pay: 0, shifts: 0 }; });

  for (const s of filtered) {
    const p = calculateShiftPremiums(s, settings);
    for (const def of PREMIUM_DEFS) {
      const hrs = p[def.hoursKey] || 0;
      const pay = p[def.key] || 0;
      if (hrs > 0 || pay > 0) {
        totals[def.key].hours += hrs;
        totals[def.key].pay   += pay;
        totals[def.key].shifts++;
      }
    }
  }

  return totals;
}

function buildPatternBreakdown(shifts, minDate, maxDate) {
  const filtered = shifts.filter(
    s => (s.paid_hours || 0) > 0 &&
      !UNPAID_TYPES.includes(s.shift_type) &&
      (!minDate || s.date >= minDate) &&
      (!maxDate || s.date <= maxDate)
  );

  // Weekday vs weekend
  const weekdayVsWeekend = { weekday: { shifts: 0, hours: 0 }, weekend: { shifts: 0, hours: 0 } };
  // Day vs night
  const dayVsNight = { day: { shifts: 0, hours: 0 }, night: { shifts: 0, hours: 0 } };
  // By day of week
  const byDayOfWeek = Array.from({ length: 7 }, (_, i) => ({ label: DAY_NAMES[i], shifts: 0, hours: 0 }));
  // By hospital
  const byHospital = {};
  // By unit
  const byUnit = {};

  for (const s of filtered) {
    const h = s.paid_hours || 0;
    const dow = new Date(s.date + 'T12:00:00').getDay();

    if (isWeekend(s.date)) {
      weekdayVsWeekend.weekend.shifts++;
      weekdayVsWeekend.weekend.hours += h;
    } else {
      weekdayVsWeekend.weekday.shifts++;
      weekdayVsWeekend.weekday.hours += h;
    }

    if (isNightShift(s)) {
      dayVsNight.night.shifts++;
      dayVsNight.night.hours += h;
    } else {
      dayVsNight.day.shifts++;
      dayVsNight.day.hours += h;
    }

    byDayOfWeek[dow].shifts++;
    byDayOfWeek[dow].hours += h;

    const hosp = s.hospital || '(No hospital)';
    if (!byHospital[hosp]) byHospital[hosp] = { shifts: 0, hours: 0 };
    byHospital[hosp].shifts++;
    byHospital[hosp].hours += h;

    const unit = s.unit || '(No unit)';
    if (!byUnit[unit]) byUnit[unit] = { shifts: 0, hours: 0 };
    byUnit[unit].shifts++;
    byUnit[unit].hours += h;
  }

  return {
    weekdayVsWeekend,
    dayVsNight,
    byDayOfWeek,
    byHospital: Object.entries(byHospital).sort((a, b) => b[1].hours - a[1].hours),
    byUnit:     Object.entries(byUnit).sort((a, b) => b[1].hours - a[1].hours),
    total: filtered.length,
  };
}

// ── Small UI components ───────────────────────────────────────────────────────

function HoursCard({ label, sublabel, hours, filter }) {
  const { total, straight, overtime } = hours;
  const display = filter === 'straight' ? straight : filter === 'overtime' ? overtime : total;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {sublabel && <div className="text-[11px] text-muted-foreground -mt-1">{sublabel}</div>}
      <div className="text-3xl font-bold text-foreground mt-1">{fmtHours(display)}</div>
      {total > 0 && (
        <div className="flex gap-2 mt-1 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {fmtHours(straight)} straight
          </span>
          {overtime > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              {fmtHours(overtime)} OT
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ProportionBar({ a, b, colorA = 'bg-emerald-500', colorB = 'bg-amber-500' }) {
  const total = a + b;
  if (total === 0) return null;
  const pctA = (a / total) * 100;
  const pctB = (b / total) * 100;
  return (
    <div className="flex rounded-full overflow-hidden h-2.5 bg-muted w-full">
      <div className={`${colorA} transition-all`} style={{ width: `${pctA}%` }} />
      <div className={`${colorB} transition-all`} style={{ width: `${pctB}%` }} />
    </div>
  );
}

function StatRow({ label, shifts, hours, totalShifts, totalHours, colorClass }) {
  const pctShifts = totalShifts > 0 ? Math.round((shifts / totalShifts) * 100) : 0;
  const pctHours  = totalHours  > 0 ? Math.round((hours  / totalHours)  * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorClass}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{label}</div>
        <div className="mt-1">
          <div className="flex rounded-full overflow-hidden h-1.5 bg-muted">
            <div className={`${colorClass} transition-all`} style={{ width: `${pctHours}%` }} />
          </div>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-semibold tabular-nums text-foreground">{fmtHours(hours)}</div>
        <div className="text-[11px] text-muted-foreground">{shifts} shift{shifts !== 1 ? 's' : ''} · {pctHours}%</div>
      </div>
    </div>
  );
}

const CHART_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-rose-500', 'bg-cyan-500',
  'bg-orange-500', 'bg-teal-500', 'bg-pink-500', 'bg-indigo-500',
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ShiftAnalytics() {
  const [settings, setSettings] = useState(null);
  const [periods,  setPeriods]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [hoursFilter, setHoursFilter] = useState('all');
  // Month detail navigation: offset in months from current (0 = this month)
  const [monthOffset, setMonthOffset] = useState(0);
  // Pay period detail navigation: offset in pay periods from current (0 = this PP)
  const [ppOffset, setPpOffset] = useState(0);
  // Shift pattern view: 0 = Last Year, 1 = Year to Date, 2 = This Year (all)
  const [patternView, setPatternView] = useState(1);
  const loadingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const [settingsList, periodList] = await Promise.all([
        base44.entities.Settings.list(),
        base44.entities.PayPeriod.list('-start_date', 200),
      ]);
      const merged = settingsList.length > 0 ? {
        hourly_wage: 45,
        premium_rates: { evening: 1.4, night: 5, weekend: 3.5, super_shift: 1.85, regular_premium: 2.15, specialty: 2, short_notice: 2, responsibility_hourly: 2.5, responsibility_flat: 18.75, preceptor: 1.5, on_call_first_72: 7, on_call_beyond_72: 7.5 },
        ...settingsList[0],
      } : null;
      setSettings(merged);
      setPeriods(periodList);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const u1 = base44.entities.Settings.subscribe(() => loadData());
    const u2 = base44.entities.PayPeriod.subscribe(() => loadData());
    return () => { u1(); u2(); };
  }, [loadData]);

  const now      = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const allShifts = periods.flatMap(p => p.shifts || []);

  // ── This Week (Mon–Sun) ──
  const dow      = now.getDay();
  const weekStart = addDays(todayStr, dow === 0 ? -6 : 1 - dow);
  const weekEnd   = addDays(weekStart, 6);

  // ── Pay periods ──
  const { start_date: curPPStart, end_date: curPPEnd } = getCurrentPayPeriodDates();
  const nextPPStart = addDays(curPPStart, 14);
  const nextPPEnd   = addDays(curPPEnd,   14);

  // ── Months ──
  const thisMonthS  = monthStart(now.getFullYear(), now.getMonth());
  const thisMonthE  = monthEnd(now.getFullYear(), now.getMonth());
  const nextMonthY  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const nextMonthM  = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  const nextMonthS  = monthStart(nextMonthY, nextMonthM);
  const nextMonthE  = monthEnd(nextMonthY, nextMonthM);

  // ── Year ──
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearEnd   = `${now.getFullYear()}-12-31`;

  // ── Detail panel: navigable month ──
  const detailMonthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const detailMonthY = detailMonthDate.getFullYear();
  const detailMonthM = detailMonthDate.getMonth();
  const detailMonthS = monthStart(detailMonthY, detailMonthM);
  const detailMonthE = monthEnd(detailMonthY, detailMonthM);
  const detailMonthLabel = detailMonthDate.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
  const detailMonthHours = getHoursForShifts(allShifts, detailMonthS, detailMonthE);

  // ── Detail panel: navigable pay period ──
  const detailPPStart = addDays(curPPStart, ppOffset * 14);
  const detailPPEnd   = addDays(curPPEnd,   ppOffset * 14);
  const detailPPLabel = ppOffset === 0 ? 'Current Pay Period'
    : ppOffset === -1 ? 'Last Pay Period'
    : ppOffset === 1  ? 'Next Pay Period'
    : ppOffset < 0    ? `${Math.abs(ppOffset)} Pay Periods Ago`
    : `${ppOffset} Pay Periods Ahead`;
  const detailPPHours = getHoursForShifts(allShifts, detailPPStart, detailPPEnd);

  // Hours buckets
  const thisWeekHours  = getHoursForShifts(allShifts, weekStart,  weekEnd);
  const thisPPHours    = getHoursForShifts(allShifts, curPPStart, curPPEnd);
  const nextPPHours    = getHoursForShifts(allShifts, nextPPStart,nextPPEnd);
  const thisMonthHours = getHoursForShifts(allShifts, thisMonthS, thisMonthE);
  const nextMonthHours = getHoursForShifts(allShifts, nextMonthS, nextMonthE);
  const ytdHours       = getHoursForShifts(allShifts, yearStart,  todayStr);
  const thisYearHours  = getHoursForShifts(allShifts, yearStart,  yearEnd);

  // Labels
  const thisMonthLabel = now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
  const nextMonthLabel = new Date(nextMonthY, nextMonthM).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  const breakdownRows = [
    { label: 'This Week',       sublabel: `${ppFmt(weekStart)} – ${ppFmt(weekEnd)}`,       hours: thisWeekHours },
    { label: 'This Pay Period', sublabel: `${ppFmt(curPPStart)} – ${ppFmt(curPPEnd)}`,     hours: thisPPHours },
    { label: 'Next Pay Period', sublabel: `${ppFmt(nextPPStart)} – ${ppFmt(nextPPEnd)}`,   hours: nextPPHours },
    { label: thisMonthLabel,    sublabel: 'This Month',                                     hours: thisMonthHours },
    { label: nextMonthLabel,    sublabel: 'Next Month',                                     hours: nextMonthHours },
    { label: 'Year to Date',    sublabel: `Jan 1 – ${ppFmt(todayStr)}`,                    hours: ytdHours },
    { label: `${now.getFullYear()} Total`, sublabel: 'Hours to be worked this year',        hours: thisYearHours },
  ];

  // Shift-pattern breakdown — window driven by patternView
  const lastYearStart = `${now.getFullYear() - 1}-01-01`;
  const lastYearEnd   = `${now.getFullYear() - 1}-12-31`;
  const PATTERN_VIEWS = [
    { label: `${now.getFullYear() - 1}`, sublabel: 'Last Year',         minDate: lastYearStart, maxDate: lastYearEnd },
    { label: 'Year to Date',             sublabel: `Jan 1 – ${ppFmt(todayStr)}`, minDate: yearStart, maxDate: todayStr },
    { label: `${now.getFullYear()}`,     sublabel: 'This Year (all shifts)', minDate: yearStart, maxDate: yearEnd },
  ];
  const activePatternView = PATTERN_VIEWS[patternView];
  const patternYTD = buildPatternBreakdown(allShifts, activePatternView.minDate, activePatternView.maxDate);
  const totalPatternHours  = patternYTD.byDayOfWeek.reduce((s, d) => s + d.hours, 0);
  const totalPatternShifts = patternYTD.total;
  const premiumBreakdown   = buildPremiumBreakdown(allShifts, activePatternView.minDate, activePatternView.maxDate, settings);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-muted-foreground text-sm">Loading analytics…</div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-5xl pb-10">

      {/* ── Header + filter toggle ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Shift Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hours worked across all time periods · OT = stat holidays and day-off shifts
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-shrink-0">
          {[
            { value: 'all',      label: 'All Hours' },
            { value: 'straight', label: 'Straight Time' },
            { value: 'overtime', label: 'OT / Stat' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setHoursFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                hoursFilter === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <HoursCard label="This Week"       sublabel={`${ppFmt(weekStart)} – ${ppFmt(weekEnd)}`}       hours={thisWeekHours}  filter={hoursFilter} />
          <HoursCard label="This Pay Period" sublabel={`${ppFmt(curPPStart)} – ${ppFmt(curPPEnd)}`}     hours={thisPPHours}    filter={hoursFilter} />
          <HoursCard label="This Month"      sublabel={thisMonthLabel}                                   hours={thisMonthHours} filter={hoursFilter} />
          <HoursCard label="Next Pay Period" sublabel={`${ppFmt(nextPPStart)} – ${ppFmt(nextPPEnd)}`}   hours={nextPPHours}    filter={hoursFilter} />
          <HoursCard label="Next Month"      sublabel={nextMonthLabel}                                   hours={nextMonthHours} filter={hoursFilter} />
        </div>
      </section>

      {/* ── Month detail panel (navigable) ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Month — Hours Detail
          </h2>
          <div className="flex items-center gap-1">
            <div className="w-[52px] flex justify-start">
              {monthOffset !== 0 && (
                <button
                  onClick={() => setMonthOffset(0)}
                  className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Current
                </button>
              )}
            </div>
            <button
              onClick={() => setMonthOffset(o => o - 1)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-foreground min-w-[140px] text-center">{detailMonthLabel}</span>
            <button
              onClick={() => setMonthOffset(o => o + 1)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex gap-6 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <div className="text-xs text-muted-foreground mb-1">Total Hours</div>
              <div className="text-2xl font-bold">{fmtHours(
                hoursFilter === 'straight' ? detailMonthHours.straight
                  : hoursFilter === 'overtime' ? detailMonthHours.overtime
                  : detailMonthHours.total
              )}</div>
            </div>
            <div className="flex-1 min-w-[120px]">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Straight Time
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fmtHours(detailMonthHours.straight)}</div>
            </div>
            <div className="flex-1 min-w-[120px]">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> OT / Stat Hours
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{fmtHours(detailMonthHours.overtime)}</div>
            </div>
            <div className="flex-1 min-w-[120px]">
              <div className="text-xs text-muted-foreground mb-1">Shifts</div>
              <div className="text-2xl font-bold">{detailMonthHours.shiftCount}</div>
            </div>
          </div>
          {detailMonthHours.total > 0 ? (
            <div>
              <ProportionBar a={detailMonthHours.straight} b={detailMonthHours.overtime} />
              <div className="flex gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Straight time ({Math.round((detailMonthHours.straight / detailMonthHours.total) * 100)}%)
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  OT / stat ({Math.round((detailMonthHours.overtime / detailMonthHours.total) * 100)}%)
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No shifts recorded for {detailMonthLabel}.</p>
          )}
        </div>
      </section>

      {/* ── Pay period detail panel (navigable) ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pay Period — Hours Detail
          </h2>
          <div className="flex items-center gap-1">
            <div className="w-[52px] flex justify-start">
              {ppOffset !== 0 && (
                <button
                  onClick={() => setPpOffset(0)}
                  className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Current
                </button>
              )}
            </div>
            <button
              onClick={() => setPpOffset(o => o - 1)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Previous pay period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-foreground min-w-[180px] text-center">
              {ppFmt(detailPPStart)} – {ppFmt(detailPPEnd)}
            </span>
            <button
              onClick={() => setPpOffset(o => o + 1)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Next pay period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="text-xs text-muted-foreground -mt-1 mb-1">{detailPPLabel}</div>
          <div className="flex gap-6 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <div className="text-xs text-muted-foreground mb-1">Total Hours</div>
              <div className="text-2xl font-bold">{fmtHours(
                hoursFilter === 'straight' ? detailPPHours.straight
                  : hoursFilter === 'overtime' ? detailPPHours.overtime
                  : detailPPHours.total
              )}</div>
            </div>
            <div className="flex-1 min-w-[120px]">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Straight Time
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fmtHours(detailPPHours.straight)}</div>
            </div>
            <div className="flex-1 min-w-[120px]">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> OT / Stat Hours
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{fmtHours(detailPPHours.overtime)}</div>
            </div>
            <div className="flex-1 min-w-[120px]">
              <div className="text-xs text-muted-foreground mb-1">Shifts</div>
              <div className="text-2xl font-bold">{detailPPHours.shiftCount}</div>
            </div>
          </div>
          {detailPPHours.total > 0 ? (
            <div>
              <ProportionBar a={detailPPHours.straight} b={detailPPHours.overtime} />
              <div className="flex gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Straight time ({Math.round((detailPPHours.straight / detailPPHours.total) * 100)}%)
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  OT / stat ({Math.round((detailPPHours.overtime / detailPPHours.total) * 100)}%)
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No shifts recorded for this pay period.</p>
          )}
        </div>
      </section>

      {/* ── Full breakdown table ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Full Breakdown</h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="py-3 pl-5 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Period</th>
                <th className="py-3 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {hoursFilter === 'straight' ? 'Straight Time' : hoursFilter === 'overtime' ? 'OT / Stat' : 'Total'}
                </th>
                <th className="py-3 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Straight</th>
                <th className="py-3 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">OT / Stat</th>
                <th className="py-3 pr-5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shifts</th>
              </tr>
            </thead>
            <tbody>
              {breakdownRows.map(row => (
                <tr key={row.label} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 pl-5 pr-4">
                    <div className="text-sm font-medium text-foreground">{row.label}</div>
                    {row.sublabel && <div className="text-xs text-muted-foreground">{row.sublabel}</div>}
                  </td>
                  <td className="py-3 pr-4 text-right text-sm font-semibold text-foreground tabular-nums">
                    {fmtHours(hoursFilter === 'straight' ? row.hours.straight : hoursFilter === 'overtime' ? row.hours.overtime : row.hours.total)}
                  </td>
                  <td className="py-3 pr-4 text-right text-sm tabular-nums text-emerald-700 dark:text-emerald-400">
                    {fmtHours(row.hours.straight)}
                  </td>
                  <td className="py-3 pr-4 text-right text-sm tabular-nums">
                    {row.hours.overtime > 0
                      ? <span className="text-amber-700 dark:text-amber-400">{fmtHours(row.hours.overtime)}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3 pr-5 text-right text-sm text-muted-foreground tabular-nums">
                    {row.hours.shiftCount || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Straight time — all hours on regular, non-stat days
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            OT / stat — stat holidays and day-off shifts (worked on a scheduled day off)
          </span>
        </div>
      </section>

      {/* ── Shift patterns ── */}
      {totalPatternShifts > 0 && (
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Shift Patterns
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPatternView(v => Math.max(0, v - 1))}
                disabled={patternView === 0}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-foreground min-w-[140px] text-center">
                {activePatternView.label}
              </span>
              <button
                onClick={() => setPatternView(v => Math.min(PATTERN_VIEWS.length - 1, v + 1))}
                disabled={patternView === PATTERN_VIEWS.length - 1}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">{activePatternView.sublabel}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Weekday vs Weekend */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Weekday vs Weekend</h3>
              <div className="space-y-1">
                {[
                  { label: 'Weekday',  color: 'bg-blue-500',  data: patternYTD.weekdayVsWeekend.weekday },
                  { label: 'Weekend',  color: 'bg-violet-500', data: patternYTD.weekdayVsWeekend.weekend },
                ].map(({ label, color, data }) => (
                  <StatRow
                    key={label}
                    label={label}
                    shifts={data.shifts}
                    hours={data.hours}
                    totalShifts={totalPatternShifts}
                    totalHours={totalPatternHours}
                    colorClass={color}
                  />
                ))}
              </div>
              <div className="mt-3">
                <ProportionBar
                  a={patternYTD.weekdayVsWeekend.weekday.hours}
                  b={patternYTD.weekdayVsWeekend.weekend.hours}
                  colorA="bg-blue-500"
                  colorB="bg-violet-500"
                />
                <div className="flex gap-4 mt-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Weekday
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" /> Weekend
                  </span>
                </div>
              </div>
            </div>

            {/* Day vs Night */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Day vs Night Shift</h3>
              <div className="space-y-1">
                {[
                  { label: 'Day (starts before 15:30)',   color: 'bg-amber-500',  data: patternYTD.dayVsNight.day },
                  { label: 'Night (starts 15:30 or later)', color: 'bg-indigo-500', data: patternYTD.dayVsNight.night },
                ].map(({ label, color, data }) => (
                  <StatRow
                    key={label}
                    label={label}
                    shifts={data.shifts}
                    hours={data.hours}
                    totalShifts={totalPatternShifts}
                    totalHours={totalPatternHours}
                    colorClass={color}
                  />
                ))}
              </div>
              <div className="mt-3">
                <ProportionBar
                  a={patternYTD.dayVsNight.day.hours}
                  b={patternYTD.dayVsNight.night.hours}
                  colorA="bg-amber-500"
                  colorB="bg-indigo-500"
                />
                <div className="flex gap-4 mt-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Day
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Night
                  </span>
                </div>
              </div>
            </div>

            {/* By day of week */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">By Day of Week</h3>
              <div className="space-y-1">
                {patternYTD.byDayOfWeek.map((d, i) => (
                  <StatRow
                    key={d.label}
                    label={d.label}
                    shifts={d.shifts}
                    hours={d.hours}
                    totalShifts={totalPatternShifts}
                    totalHours={totalPatternHours}
                    colorClass={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </div>
            </div>

            {/* By hospital + by unit stacked */}
            <div className="space-y-4">
              {patternYTD.byHospital.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">By Hospital</h3>
                  <div className="space-y-1">
                    {patternYTD.byHospital.map(([hosp, data], i) => (
                      <StatRow
                        key={hosp}
                        label={hosp}
                        shifts={data.shifts}
                        hours={data.hours}
                        totalShifts={totalPatternShifts}
                        totalHours={totalPatternHours}
                        colorClass={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </div>
                </div>
              )}

              {patternYTD.byUnit.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">By Unit</h3>
                  <div className="space-y-1">
                    {patternYTD.byUnit.map(([unit, data], i) => (
                      <StatRow
                        key={unit}
                        label={unit}
                        shifts={data.shifts}
                        hours={data.hours}
                        totalShifts={totalPatternShifts}
                        totalHours={totalPatternHours}
                        colorClass={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ── Premium breakdown ── */}
          {premiumBreakdown && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Premium Hours</h3>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="py-2.5 pl-5 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Premium</th>
                      <th className="py-2.5 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hours</th>
                      <th className="py-2.5 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shifts</th>
                      <th className="py-2.5 pr-5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-1/3">Distribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const maxHours = Math.max(...PREMIUM_DEFS.map(d => premiumBreakdown[d.key].hours));
                      return PREMIUM_DEFS
                        .filter(def => premiumBreakdown[def.key].hours > 0 || premiumBreakdown[def.key].shifts > 0)
                        .map(def => {
                          const { hours, shifts } = premiumBreakdown[def.key];
                          const pct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
                          return (
                            <tr key={def.key} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 pl-5 pr-4">
                                <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${def.color}`} />
                                  {def.label}
                                </span>
                              </td>
                              <td className="py-2.5 pr-4 text-right text-sm font-semibold tabular-nums text-foreground">
                                {fmtHours(hours)}
                              </td>
                              <td className="py-2.5 pr-4 text-right text-sm tabular-nums text-muted-foreground">
                                {shifts}
                              </td>
                              <td className="py-2.5 pr-5">
                                <div className="flex rounded-full overflow-hidden h-2 bg-muted">
                                  <div className={`${def.color} transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
                {PREMIUM_DEFS.every(d => premiumBreakdown[d.key].hours === 0) && (
                  <p className="text-sm text-muted-foreground px-5 py-4">No premium hours recorded for this period.</p>
                )}
              </div>
            </div>
          )}

        </section>
      )}

    </div>
  );
}
