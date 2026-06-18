import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PaySummaryPanel from '@/components/payroll/PaySummaryPanel';
import EarningsTrendChart from '@/components/payroll/EarningsTrendChart';
import { calculatePeriodBreakdown, getCurrentPayPeriodDates } from '@/lib/premiumCalculator';
import { Button } from '@/components/ui/button';
import { CalendarPlus } from 'lucide-react';
import SetupBanner from '@/components/payroll/SetupBanner';

// Helper: add 14 days to an ISO date string
const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export default function Dashboard() {
  const [settings, setSettings] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadingRef = useRef(false);
  const loadRef = useRef(null);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    if (loadRef.current) { clearTimeout(loadRef.current); loadRef.current = null; }
    loadingRef.current = true;
    setLoading(true);
    try {
      const settingsList = await base44.entities.Settings.list();
      let periodList = await base44.entities.PayPeriod.list('-start_date', 100);

      if (settingsList.length === 0) {
        const created = await base44.entities.Settings.create({
          hourly_wage: 45,
          ot_multipliers: { overtime: 1.5, overtime_extended: 2, stat_holiday: 1.5, ot_stat_holiday: 3 },
          premium_rates: { evening: 1.4, night: 5, weekend: 3.5, super_shift: 1.85, regular_premium: 2.15, specialty: 2, short_notice: 2, responsibility_hourly: 2.5, responsibility_flat: 18.75, preceptor: 1.5, on_call_first_72: 7, on_call_beyond_72: 7.5 },
          preset_times: { day_12h_start: '07:00', day_12h_end: '19:00', night_12h_start: '19:00', night_12h_end: '07:00', day_8h_start: '08:00', day_8h_end: '16:00' },
          active_allowances: ['isolation'],
          active_qualifications: [],
          hospitals: [],
          units: [],
          default_shift_pattern: 'DDNN',
        });
        settingsList = [created];
      }

      setSettings(settingsList[0]);
      setPeriods(periodList);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const debouncedLoad = useCallback(() => {
    if (loadRef.current) clearTimeout(loadRef.current);
    loadRef.current = setTimeout(() => loadData(), 300);
  }, [loadData]);

  useEffect(() => {
    const unsub1 = base44.entities.Settings.subscribe(() => debouncedLoad());
    const unsub2 = base44.entities.PayPeriod.subscribe(() => debouncedLoad());
    return () => { unsub1(); unsub2(); };
  }, [debouncedLoad]);

  const computedPeriods = periods.map(p => ({
    ...p,
    computedBreakdown: p.breakdown || (settings && p.shifts?.length ? calculatePeriodBreakdown(p.shifts, settings) : null),
  }));

  const totalShifts = periods.reduce((sum, p) => sum + (p.shifts?.length || 0), 0);
  const hasCustomWage = settings && settings.hourly_wage !== 45;
  const hasTaxSettings = settings?.tax_settings?.annual_federal_income > 0 || settings?.tax_settings?.annual_provincial_income > 0;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // ── Pay Periods ──
  const { start_date: curStart, end_date: curEnd } = getCurrentPayPeriodDates();
  const currentPeriod = computedPeriods.find(p => p.start_date === curStart && p.end_date === curEnd);

  // Past: most recently completed (end_date < today), ordered by end_date desc
  const pastPeriod = computedPeriods
    .filter(p => p.end_date < todayStr)
    .sort((a, b) => b.end_date.localeCompare(a.end_date))[0] || null;

  // Next: start_date = current start + 14 days
  const nextStart = addDays(curStart, 14);
  const nextEnd = addDays(curEnd, 14);
  const nextPeriod = computedPeriods.find(p => p.start_date === nextStart && p.end_date === nextEnd) || null;

  // ── Helper: sum breakdowns with monthly-allowance cap ──
  const sumBreakdowns = (periodsList, maxDate) => {
    if (periodsList.length === 0 || !settings) return null;

    // Compute allowance: monthly max × months that have ≥1 shift
    const monthsWithShifts = new Set();
    for (const p of periodsList) {
      for (const shift of (p.shifts || [])) {
        if (maxDate && shift.date > maxDate) continue;
        monthsWithShifts.add(shift.date.substring(0, 7));
      }
    }
    const monthlyAllowance = (settings.active_allowances || []).reduce((sum, k) => sum + (settings.allowance_rates?.[k] || 0), 0);
    const allowanceTotal = monthsWithShifts.size * monthlyAllowance;

    const base = periodsList.reduce((acc, p) => {
      const shifts = p.shifts || [];
      const filtered = maxDate ? shifts.filter(s => s.date <= maxDate) : shifts;
      if (filtered.length === 0) return acc;
      const b = settings ? calculatePeriodBreakdown(filtered, settings) : null;
      if (!b) return acc;
      return {
        straight_time_pay: (acc.straight_time_pay || 0) + b.straight_time_pay,
        overtime_pay: (acc.overtime_pay || 0) + b.overtime_pay,
        regular_premium_total: (acc.regular_premium_total || 0) + b.regular_premium_total,
        evening_premium_total: (acc.evening_premium_total || 0) + b.evening_premium_total,
        night_premium_total: (acc.night_premium_total || 0) + b.night_premium_total,
        weekend_premium_total: (acc.weekend_premium_total || 0) + b.weekend_premium_total,
        super_shift_premium_total: (acc.super_shift_premium_total || 0) + b.super_shift_premium_total,
        short_notice_total: (acc.short_notice_total || 0) + b.short_notice_total,
        responsibility_total: (acc.responsibility_total || 0) + b.responsibility_total,
        preceptor_total: (acc.preceptor_total || 0) + b.preceptor_total,
        specialty_premium_total: (acc.specialty_premium_total || 0) + b.specialty_premium_total,
        on_call_total: (acc.on_call_total || 0) + b.on_call_total,
        qualification_total: (acc.qualification_total || 0) + b.qualification_total,
        union_dues: (acc.union_dues || 0) + b.union_dues,
        regular_hours: (acc.regular_hours || 0) + b.regular_hours,
        gross_pay: (acc.gross_pay || 0) + b.gross_pay,
      };
    }, {});

    if (!base) return null;

    // Replace prorated period allowances with monthly-capped total, adjust gross
    const oldAllowance = periodsList.reduce((sum, p) => {
      const shifts = p.shifts || [];
      const filtered = maxDate ? shifts.filter(s => s.date <= maxDate) : shifts;
      const b = filtered.length > 0 && settings ? calculatePeriodBreakdown(filtered, settings) : null;
      return sum + (b?.allowance_total || 0);
    }, 0);
    base.allowance_total = allowanceTotal;
    base.allowance_monthly = monthlyAllowance;
    base.gross_pay = (base.gross_pay || 0) - oldAllowance + allowanceTotal;

    return base;
  };

  const countShifts = (periodsList, maxDate) =>
    periodsList.reduce((sum, p) => {
      const shifts = p.shifts || [];
      return sum + (maxDate ? shifts.filter(s => s.date <= maxDate).length : shifts.length);
    }, 0);

  // ── Monthly ──
  const monthStart = (y, m) => new Date(y, m, 1).toISOString().split('T')[0];
  const monthEnd = (y, m) => new Date(y, m + 1, 0).toISOString().split('T')[0];

  // This month
  const thisMonthStart = monthStart(now.getFullYear(), now.getMonth());
  const thisMonthEnd = monthEnd(now.getFullYear(), now.getMonth());
  const thisMonthPeriods = computedPeriods.filter(p => p.start_date >= thisMonthStart && p.start_date <= thisMonthEnd);
  const thisMonthBreakdown = sumBreakdowns(thisMonthPeriods, null);
  const thisMonthShiftCount = countShifts(thisMonthPeriods, null);
  const thisMonthLabel = now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  // Last month
  const lastMonthY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const lastMonthM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastMonthStart = monthStart(lastMonthY, lastMonthM);
  const lastMonthEnd = monthEnd(lastMonthY, lastMonthM);
  const lastMonthPeriods = computedPeriods.filter(p => p.start_date >= lastMonthStart && p.start_date <= lastMonthEnd);
  const lastMonthBreakdown = sumBreakdowns(lastMonthPeriods, null);
  const lastMonthShiftCount = countShifts(lastMonthPeriods, null);
  const lastMonthLabel = new Date(lastMonthY, lastMonthM).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  // Next month
  const nextMonthY = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const nextMonthM = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  const nextMonthStart = monthStart(nextMonthY, nextMonthM);
  const nextMonthEnd = monthEnd(nextMonthY, nextMonthM);
  const nextMonthPeriods = computedPeriods.filter(p => p.start_date >= nextMonthStart && p.start_date <= nextMonthEnd);
  const nextMonthBreakdown = sumBreakdowns(nextMonthPeriods, null);
  const nextMonthShiftCount = countShifts(nextMonthPeriods, null);
  const nextMonthLabel = new Date(nextMonthY, nextMonthM).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  // ── Yearly ──
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearPeriods = computedPeriods.filter(p => p.start_date >= yearStart);

  const ytdShiftCount = countShifts(yearPeriods, todayStr);
  const ytdBreakdown = sumBreakdowns(yearPeriods, todayStr);

  const thisYearShiftCount = countShifts(yearPeriods, null);
  const thisYearBreakdown = sumBreakdowns(yearPeriods, null);

  // Last year (if any data exists)
  const lastYearStart = `${now.getFullYear() - 1}-01-01`;
  const lastYearEnd = `${now.getFullYear() - 1}-12-31`;
  const lastYearPeriods = computedPeriods.filter(p => p.start_date >= lastYearStart && p.start_date <= lastYearEnd);
  const lastYearBreakdown = sumBreakdowns(lastYearPeriods, null);
  const lastYearShiftCount = countShifts(lastYearPeriods, null);
  const lastYearLabel = `${now.getFullYear() - 1}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Pay period summaries at a glance</p>
        </div>
        <Link to="/pay-period">
          <Button size="sm" className="bg-primary text-primary-foreground">
            <CalendarPlus className="w-4 h-4 mr-2" />
            Current Pay Period
          </Button>
        </Link>
      </div>

      {!loading && (
        <SetupBanner
          hasShifts={totalShifts > 0}
          hasWage={hasCustomWage}
          hasTaxSettings={hasTaxSettings}
        />
      )}

      {/* ── Pay Period Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PaySummaryPanel
          title="Past Pay Period"
          subtitle={pastPeriod ? pastPeriod.name : 'No data'}
          breakdown={pastPeriod?.computedBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={pastPeriod?.shifts?.length || 0}
          verifiedDeductions={pastPeriod?.verified_deductions}
        />
        <PaySummaryPanel
          title="Current Pay Period"
          subtitle={currentPeriod ? currentPeriod.name : 'No pay period yet'}
          breakdown={currentPeriod?.computedBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={currentPeriod?.shifts?.length || 0}
        />
        <PaySummaryPanel
          title="Next Pay Period"
          subtitle={nextPeriod ? nextPeriod.name : 'Not yet created'}
          breakdown={nextPeriod?.computedBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={nextPeriod?.shifts?.length || 0}
        />
      </div>

      {/* ── Monthly Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PaySummaryPanel
          title="Last Month"
          subtitle={lastMonthLabel}
          breakdown={lastMonthBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={lastMonthShiftCount}
        />
        <PaySummaryPanel
          title="This Month"
          subtitle={thisMonthLabel}
          breakdown={thisMonthBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={thisMonthShiftCount}
        />
        <PaySummaryPanel
          title="Next Month"
          subtitle={nextMonthLabel}
          breakdown={nextMonthBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={nextMonthShiftCount}
        />
      </div>

      {/* ── Yearly Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {lastYearBreakdown ? (
          <PaySummaryPanel
            title="Last Year"
            subtitle={lastYearLabel}
            breakdown={lastYearBreakdown}
            loading={loading}
            taxSettings={settings?.tax_settings}
            shiftCount={lastYearShiftCount}
          />
        ) : (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-base font-display font-semibold text-foreground">Last Year</h3>
            <p className="text-xs text-muted-foreground mt-1">{lastYearLabel}</p>
            <p className="text-sm text-muted-foreground mt-4">No data available for last year.</p>
          </div>
        )}
        <PaySummaryPanel
          title="Year to Date"
          subtitle={`Jan 1 – Today (${ytdShiftCount} shifts)`}
          breakdown={ytdBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={ytdShiftCount}
        />
        <PaySummaryPanel
          title="This Year"
          subtitle={`Jan 1 – Dec 31 (${thisYearShiftCount} shifts)`}
          breakdown={thisYearBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={thisYearShiftCount}
        />
      </div>

      {/* ── Past Trend Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EarningsTrendChart
          periods={computedPeriods}
          settings={settings}
          chartType="months_past"
          title="Earnings Trend — Last 6 Months"
        />
        <EarningsTrendChart
          periods={computedPeriods}
          settings={settings}
          chartType="periods_past"
          title="Earnings Trend — Last 6 Pay Periods"
        />
      </div>

      {/* ── Future Trend Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EarningsTrendChart
          periods={computedPeriods}
          settings={settings}
          chartType="months_future"
          title="Earnings Trend — Next 6 Months"
        />
        <EarningsTrendChart
          periods={computedPeriods}
          settings={settings}
          chartType="periods_future"
          title="Earnings Trend — Next 6 Pay Periods"
        />
      </div>
    </div>
  );
}