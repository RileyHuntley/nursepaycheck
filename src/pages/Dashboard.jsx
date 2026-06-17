import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PaySummaryPanel from '@/components/payroll/PaySummaryPanel';
import EarningsTrendChart from '@/components/payroll/EarningsTrendChart';
import { calculatePeriodBreakdown, getCurrentPayPeriodDates } from '@/lib/premiumCalculator';
import { Button } from '@/components/ui/button';
import { CalendarPlus } from 'lucide-react';

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

  // Real-time subscriptions with debounce to prevent rate limiting
  const debouncedLoad = useCallback(() => {
    if (loadRef.current) {
      clearTimeout(loadRef.current);
    }
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

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Current pay period
  const { start_date, end_date } = getCurrentPayPeriodDates();
  const current = computedPeriods.find(p => p.start_date === start_date && p.end_date === end_date);
  const currentShiftCount = current?.shifts?.length || 0;

  // --- Helper: sum breakdowns from a list of periods (optionally filtering shifts) ---
  const sumBreakdowns = (periodsList, maxDate) => {
    if (periodsList.length === 0 || !settings) return null;
    return periodsList.reduce((acc, p) => {
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
        allowance_total: (acc.allowance_total || 0) + b.allowance_total,
        qualification_total: (acc.qualification_total || 0) + b.qualification_total,
        union_dues: (acc.union_dues || 0) + b.union_dues,
        gross_pay: (acc.gross_pay || 0) + b.gross_pay,
        regular_hours: (acc.regular_hours || 0) + b.regular_hours,
      };
    }, {});
  };

  const countShifts = (periodsList, maxDate) =>
    periodsList.reduce((sum, p) => {
      const shifts = p.shifts || [];
      return sum + (maxDate ? shifts.filter(s => s.date <= maxDate).length : shifts.length);
    }, 0);

  // Current month totals
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const monthPeriods = computedPeriods.filter(p => p.start_date >= monthStart && p.start_date <= monthEnd);
  const monthShiftCount = countShifts(monthPeriods, null);
  const monthBreakdown = sumBreakdowns(monthPeriods, null);

  const monthLabel = now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  // Next month totals (future — include upcoming shifts)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStart = nextMonth.toISOString().split('T')[0];
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];
  const nextMonthPeriods = computedPeriods.filter(p => p.start_date >= nextMonthStart && p.start_date <= nextMonthEnd);
  const nextMonthShiftCount = countShifts(nextMonthPeriods, null);
  const nextMonthBreakdown = sumBreakdowns(nextMonthPeriods, null);
  const nextMonthLabel = nextMonth.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  // This year all periods
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearPeriods = computedPeriods.filter(p => p.start_date >= yearStart);

  // Year to Date (shifts up to today only)
  const ytdShiftCount = countShifts(yearPeriods, todayStr);
  const ytdBreakdown = sumBreakdowns(yearPeriods, todayStr);

  // This Year Estimated (all shifts including future)
  const thisYearShiftCount = countShifts(yearPeriods, null);
  const thisYearBreakdown = sumBreakdowns(yearPeriods, null);

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <PaySummaryPanel
          title="Current Pay Period"
          subtitle={current ? current.name : 'No pay period yet'}
          breakdown={current?.computedBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={currentShiftCount}
        />
        <PaySummaryPanel
          title="This Month"
          subtitle={monthLabel}
          breakdown={monthBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={monthShiftCount}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PaySummaryPanel
          title="Year to Date"
          subtitle={`Jan 1 – Today (${ytdShiftCount} shifts)`}
          breakdown={ytdBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={ytdShiftCount}
        />
        <PaySummaryPanel
          title="This Year (Estimated)"
          subtitle={`Jan 1 – Dec 31 (${thisYearShiftCount} shifts)`}
          breakdown={thisYearBreakdown}
          loading={loading}
          taxSettings={settings?.tax_settings}
          shiftCount={thisYearShiftCount}
        />
      </div>

      <EarningsTrendChart periods={computedPeriods} settings={settings} />
    </div>
  );
}