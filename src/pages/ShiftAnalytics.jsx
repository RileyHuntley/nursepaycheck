import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { calculatePeriodBreakdown, getCurrentPayPeriodDates } from '@/lib/premiumCalculator';
import { BarChart3 } from 'lucide-react';

const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const monthStart = (y, m) => new Date(y, m, 1).toISOString().split('T')[0];
const monthEnd = (y, m) => new Date(y, m + 1, 0).toISOString().split('T')[0];

const fmtHours = (h) => {
  if (h == null || isNaN(h)) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

function getHoursForShifts(shifts, minDate, maxDate, settings) {
  const filtered = shifts.filter(
    s => s.paid_hours > 0 &&
      (!minDate || s.date >= minDate) &&
      (!maxDate || s.date <= maxDate)
  );
  if (filtered.length === 0) return { total: 0, straight: 0, overtime: 0, shiftCount: 0 };

  const breakdown = settings ? calculatePeriodBreakdown(filtered, settings) : null;
  const total = filtered.reduce((sum, s) => sum + (s.paid_hours || 0), 0);
  const straight = breakdown?.regular_hours ?? total;
  const overtime = Math.max(0, total - straight);
  return { total, straight, overtime, shiftCount: filtered.length };
}

function HoursCard({ label, sublabel, hours, showDetail, filter }) {
  const { total, straight, overtime } = hours;

  const displayHours = filter === 'straight' ? straight
    : filter === 'overtime' ? overtime
    : total;

  const hasOvertime = overtime > 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {sublabel && <div className="text-[11px] text-muted-foreground -mt-1">{sublabel}</div>}
      <div className="text-3xl font-bold text-foreground mt-1">{fmtHours(displayHours)}</div>
      {showDetail && total > 0 && (
        <div className="flex gap-3 mt-1 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {fmtHours(straight)} straight
          </span>
          {hasOvertime && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              {fmtHours(overtime)} OT/stat
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ label, hours, filter }) {
  const { total, straight, overtime, shiftCount } = hours;
  const displayHours = filter === 'straight' ? straight
    : filter === 'overtime' ? overtime
    : total;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pr-4 text-sm font-medium text-foreground whitespace-nowrap">{label}</td>
      <td className="py-3 pr-4 text-sm text-right font-semibold text-foreground tabular-nums">{fmtHours(displayHours)}</td>
      <td className="py-3 pr-4 text-sm text-right tabular-nums">
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          {fmtHours(straight)}
        </span>
      </td>
      <td className="py-3 pr-4 text-sm text-right tabular-nums">
        {overtime > 0 ? (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
            {fmtHours(overtime)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-3 text-sm text-right text-muted-foreground tabular-nums">{shiftCount}</td>
    </tr>
  );
}

export default function ShiftAnalytics() {
  const [settings, setSettings] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoursFilter, setHoursFilter] = useState('all');
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
        ot_multipliers: { overtime: 1.5, overtime_extended: 2, stat_holiday: 1.5, ot_stat_holiday: 3 },
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

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // All shifts flattened
  const allShifts = periods.flatMap(p => p.shifts || []);

  // ── This Week (Mon–Sun) ──
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  const weekStart = addDays(todayStr, daysToMon);
  const weekEnd = addDays(weekStart, 6);
  const thisWeekHours = getHoursForShifts(allShifts, weekStart, weekEnd, settings);

  // ── Pay Periods ──
  const { start_date: curPPStart, end_date: curPPEnd } = getCurrentPayPeriodDates();
  const nextPPStart = addDays(curPPStart, 14);
  const nextPPEnd = addDays(curPPEnd, 14);

  const thisPPHours = getHoursForShifts(allShifts, curPPStart, curPPEnd, settings);
  const nextPPHours = getHoursForShifts(allShifts, nextPPStart, nextPPEnd, settings);

  // ── Monthly ──
  const thisMonthS = monthStart(now.getFullYear(), now.getMonth());
  const thisMonthE = monthEnd(now.getFullYear(), now.getMonth());
  const nextMonthY = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const nextMonthM = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  const nextMonthS = monthStart(nextMonthY, nextMonthM);
  const nextMonthE = monthEnd(nextMonthY, nextMonthM);

  const thisMonthHours = getHoursForShifts(allShifts, thisMonthS, thisMonthE, settings);
  const nextMonthHours = getHoursForShifts(allShifts, nextMonthS, nextMonthE, settings);

  // ── Year to Date ──
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearEnd = `${now.getFullYear()}-12-31`;
  const ytdHours = getHoursForShifts(allShifts, yearStart, todayStr, settings);
  const thisYearHours = getHoursForShifts(allShifts, yearStart, yearEnd, settings);

  const thisMonthLabel = now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
  const nextMonthLabel = new Date(nextMonthY, nextMonthM).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
  const ppFmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

  const breakdownRows = [
    { label: 'This Week', sublabel: `${ppFmt(weekStart)} – ${ppFmt(weekEnd)}`, hours: thisWeekHours },
    { label: 'This Pay Period', sublabel: `${ppFmt(curPPStart)} – ${ppFmt(curPPEnd)}`, hours: thisPPHours },
    { label: 'Next Pay Period', sublabel: `${ppFmt(nextPPStart)} – ${ppFmt(nextPPEnd)}`, hours: nextPPHours },
    { label: thisMonthLabel, sublabel: 'This Month', hours: thisMonthHours },
    { label: nextMonthLabel, sublabel: 'Next Month', hours: nextMonthHours },
    { label: 'Year to Date', sublabel: `Jan 1 – ${ppFmt(todayStr)}`, hours: ytdHours },
    { label: `${now.getFullYear()} Total`, sublabel: 'Hours to be worked this year', hours: thisYearHours },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-muted-foreground text-sm">Loading analytics…</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Shift Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Hours worked across all time periods</p>
        </div>

        {/* Filter toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {[
            { value: 'all', label: 'All Hours' },
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

      {/* Summary cards */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <HoursCard
            label="This Week"
            sublabel={`${ppFmt(weekStart)} – ${ppFmt(weekEnd)}`}
            hours={thisWeekHours}
            showDetail
            filter={hoursFilter}
          />
          <HoursCard
            label="This Pay Period"
            sublabel={`${ppFmt(curPPStart)} – ${ppFmt(curPPEnd)}`}
            hours={thisPPHours}
            showDetail
            filter={hoursFilter}
          />
          <HoursCard
            label="This Month"
            sublabel={thisMonthLabel}
            hours={thisMonthHours}
            showDetail
            filter={hoursFilter}
          />
          <HoursCard
            label="Next Pay Period"
            sublabel={`${ppFmt(nextPPStart)} – ${ppFmt(nextPPEnd)}`}
            hours={nextPPHours}
            showDetail
            filter={hoursFilter}
          />
          <HoursCard
            label="Next Month"
            sublabel={nextMonthLabel}
            hours={nextMonthHours}
            showDetail
            filter={hoursFilter}
          />
        </div>
      </div>

      {/* This Month colour-coded breakdown */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {thisMonthLabel} — Hours Detail
        </h2>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex gap-6 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <div className="text-xs text-muted-foreground mb-1">Total Hours</div>
              <div className="text-2xl font-bold">{fmtHours(
                hoursFilter === 'straight' ? thisMonthHours.straight
                  : hoursFilter === 'overtime' ? thisMonthHours.overtime
                  : thisMonthHours.total
              )}</div>
            </div>
            <div className="flex-1 min-w-[140px]">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Straight Time
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {fmtHours(thisMonthHours.straight)}
              </div>
            </div>
            <div className="flex-1 min-w-[140px]">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                OT / Stat Hours
              </div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {fmtHours(thisMonthHours.overtime)}
              </div>
            </div>
            <div className="flex-1 min-w-[140px]">
              <div className="text-xs text-muted-foreground mb-1">Shifts</div>
              <div className="text-2xl font-bold">{thisMonthHours.shiftCount}</div>
            </div>
          </div>

          {/* Proportional bar */}
          {thisMonthHours.total > 0 && (
            <div className="mt-4">
              <div className="flex rounded-full overflow-hidden h-3 bg-muted">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(thisMonthHours.straight / thisMonthHours.total) * 100}%` }}
                />
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${(thisMonthHours.overtime / thisMonthHours.total) * 100}%` }}
                />
              </div>
              <div className="flex gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Straight time ({thisMonthHours.total > 0 ? Math.round((thisMonthHours.straight / thisMonthHours.total) * 100) : 0}%)
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  OT / stat ({thisMonthHours.total > 0 ? Math.round((thisMonthHours.overtime / thisMonthHours.total) * 100) : 0}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full breakdown table */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Full Breakdown</h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="py-3 pr-4 pl-5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Period</th>
                <th className="py-3 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {hoursFilter === 'straight' ? 'Straight Time' : hoursFilter === 'overtime' ? 'OT / Stat' : 'Total'}
                </th>
                <th className="py-3 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Straight Time</th>
                <th className="py-3 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">OT / Stat</th>
                <th className="py-3 pr-5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shifts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {breakdownRows.map(row => (
                <tr key={row.label} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 pr-4 pl-5">
                    <div className="text-sm font-medium text-foreground">{row.label}</div>
                    {row.sublabel && <div className="text-xs text-muted-foreground">{row.sublabel}</div>}
                  </td>
                  <td className="py-3 pr-4 text-right text-sm font-semibold text-foreground tabular-nums">
                    {fmtHours(
                      hoursFilter === 'straight' ? row.hours.straight
                        : hoursFilter === 'overtime' ? row.hours.overtime
                        : row.hours.total
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
                      {fmtHours(row.hours.straight)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {row.hours.overtime > 0 ? (
                      <span className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
                        {fmtHours(row.hours.overtime)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-5 text-right text-sm text-muted-foreground tabular-nums">
                    {row.hours.shiftCount || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-3 flex gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Straight time — hours at 1× (regular days, vacation, sick, etc.)
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            OT / stat — hours worked on statutory holidays (1.5× – 3×)
          </span>
        </div>
      </div>
    </div>
  );
}
