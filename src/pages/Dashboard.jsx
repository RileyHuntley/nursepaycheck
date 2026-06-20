import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PaySummaryPanel from '@/components/payroll/PaySummaryPanel';
import EarningsTrendChart from '@/components/payroll/EarningsTrendChart';
import { calculatePeriodBreakdown, getCurrentPayPeriodDates, getFirstPeriodsOfMonths } from '@/lib/premiumCalculator';
import { Button } from '@/components/ui/button';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import SetupBanner from '@/components/payroll/SetupBanner';
import { getVCHPeriodNumber, getVCHPayDate } from '@/lib/statHolidays';

const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const fmtDate = (s) => new Date(s + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

function NavHeader({ label, onPrev, onNext, showPrev, setShowPrev, showNext, setShowNext, prevLabel, nextLabel }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Previous"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold text-foreground min-w-[180px] text-center px-1">{label}</span>
        <button
          onClick={onNext}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowPrev(!showPrev)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
            showPrev
              ? 'bg-primary/10 text-primary border-primary/40'
              : 'border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          ← {prevLabel}
        </button>
        <button
          onClick={() => setShowNext(!showNext)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
            showNext
              ? 'bg-primary/10 text-primary border-primary/40'
              : 'border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          {nextLabel} →
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [settings, setSettings] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pay period navigation
  const [periodOffset, setPeriodOffset] = useState(0);
  const [showPrevPeriod, setShowPrevPeriod] = useState(false);
  const [showNextPeriod, setShowNextPeriod] = useState(false);

  // Monthly navigation
  const [monthOffset, setMonthOffset] = useState(0);
  const [showPrevMonth, setShowPrevMonth] = useState(false);
  const [showNextMonth, setShowNextMonth] = useState(false);

  // Yearly navigation
  const [yearOffset, setYearOffset] = useState(0);
  const [showPrevYear, setShowPrevYear] = useState(false);
  const [showNextYear, setShowNextYear] = useState(false);

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
          active_allowances: [],
          active_qualifications: [],
          hospitals: [],
          units: [],
          default_shift_pattern: 'DDNN',
        });
        settingsList = [created];
      }

      const merged = {
        hourly_wage: 45,
        ot_multipliers: { overtime: 1.5, overtime_extended: 2, stat_holiday: 1.5, ot_stat_holiday: 3 },
        premium_rates: { evening: 1.4, night: 5, weekend: 3.5, super_shift: 1.85, regular_premium: 2.15, specialty: 2, short_notice: 2, responsibility_hourly: 2.5, responsibility_flat: 18.75, preceptor: 1.5, on_call_first_72: 7, on_call_beyond_72: 7.5 },
        preset_times: { day_12h_start: '07:00', day_12h_end: '19:00', night_12h_start: '19:00', night_12h_end: '07:00', day_8h_start: '08:00', day_8h_end: '16:00' },
        active_allowances: ['isolation'],
        active_qualifications: [],
        hospitals: [],
        units: [],
        default_shift_pattern: 'DDNN',
        shift_lines: [{ status: 'full_time', fte: 1.0, hospital: '', unit: '' }],
        tax_settings: { annual_provincial_income: 0, annual_federal_income: 0 },
        ...settingsList[0],
      };
      setSettings(merged);
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

  const firstPeriodsOfMonth = settings ? getFirstPeriodsOfMonths(periods) : new Set();

  const computedPeriods = periods.map(p => {
    const isFirstOfMonth = firstPeriodsOfMonth.has(p.start_date);
    return {
      ...p,
      computedBreakdown: (p.shifts?.length && settings)
        ? (p.breakdown || calculatePeriodBreakdown(p.shifts, settings, isFirstOfMonth))
        : null,
    };
  });

  const totalShifts = periods.reduce((sum, p) => sum + (p.shifts?.length || 0), 0);
  const hasCustomWage = settings && settings.hourly_wage !== 45;
  const hasTaxSettings = settings?.tax_settings?.annual_federal_income > 0 || settings?.tax_settings?.annual_provincial_income > 0;
  const hasHospitals = (settings?.hospitals?.length || 0) > 0 && (settings?.units?.length || 0) > 0;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const { start_date: curStart, end_date: curEnd } = getCurrentPayPeriodDates();

  // ── Monthly helpers ──
  const monthStart = (y, m) => new Date(y, m, 1).toISOString().split('T')[0];
  const monthEnd = (y, m) => new Date(y, m + 1, 0).toISOString().split('T')[0];

  // ── sumBreakdowns helper ──
  const sumBreakdowns = (periodsList, minDate, maxDate) => {
    if (periodsList.length === 0 || !settings) return null;
    const monthsWithShifts = new Set();
    for (const p of periodsList) {
      for (const shift of (p.shifts || [])) {
        if (minDate && shift.date < minDate) continue;
        if (maxDate && shift.date > maxDate) continue;
        monthsWithShifts.add(shift.date.substring(0, 7));
      }
    }
    const monthlyAllowance = (settings.active_allowances || []).reduce((sum, k) => sum + (settings.allowance_rates?.[k] || 0), 0);
    const allowanceTotal = monthsWithShifts.size * monthlyAllowance;

    const base = periodsList.reduce((acc, p) => {
      const shifts = p.shifts || [];
      const filtered = shifts.filter(s =>
        (!minDate || s.date >= minDate) && (!maxDate || s.date <= maxDate)
      );
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

    if (!base || Object.keys(base).length === 0) return null;

    base.allowance_total = allowanceTotal;
    base.allowance_monthly = monthlyAllowance;
    const annualQualTotal = (settings.active_qualifications || []).reduce((sum, k) => sum + (settings.qualification_rates?.[k] || 0), 0) * 12;
    base.qualification_total = monthsWithShifts.size * (annualQualTotal / 12);
    base.qualification_annual = annualQualTotal;
    base.qualification_hourly = annualQualTotal / 1950;
    base.gross_pay = (base.gross_pay || 0) + allowanceTotal + base.qualification_total;
    return base;
  };

  const countShifts = (periodsList, minDate, maxDate) =>
    periodsList.reduce((sum, p) => {
      const shifts = p.shifts || [];
      return sum + shifts.filter(s =>
        (!minDate || s.date >= minDate) && (!maxDate || s.date <= maxDate)
      ).length;
    }, 0);

  // ── Pay period data at offset ──
  const getPeriodTitle = (offset) => {
    if (offset === 0) return 'Current Pay Period';
    if (offset === -1) return 'Previous Pay Period';
    if (offset === 1) return 'Next Pay Period';
    if (offset < 0) return `Pay Period (${Math.abs(offset)} back)`;
    return `Pay Period (${offset} ahead)`;
  };

  const getPeriodData = (offset) => {
    const start = addDays(curStart, offset * 14);
    const end = addDays(curEnd, offset * 14);
    const period = computedPeriods.find(p => p.start_date === start && p.end_date === end) || null;
    const payDate = getVCHPayDate(start);
    const payDateStr = payDate
      ? ` · Paid on ${new Date(payDate + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`
      : '';
    const subtitle = period
      ? `${period.name}${payDateStr}`
      : `${fmtDate(start)} – ${fmtDate(end)}${payDateStr}`;
    return {
      title: getPeriodTitle(offset),
      subtitle,
      breakdown: period?.computedBreakdown,
      shiftCount: period?.shifts?.length || 0,
      verifiedDeductions: period?.verified_deductions,
    };
  };

  const getPeriodNavLabel = (offset) => {
    const start = addDays(curStart, offset * 14);
    const end = addDays(curEnd, offset * 14);
    return `${fmtDate(start)} – ${fmtDate(end)}`;
  };

  // ── Month data at offset ──
  const getMonthTitle = (offset) => {
    if (offset === 0) return 'This Month';
    if (offset === -1) return 'Last Month';
    if (offset === 1) return 'Next Month';
    if (offset < 0) return 'Past Month';
    return 'Future Month';
  };

  const getMonthData = (offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const y = date.getFullYear();
    const m = date.getMonth();
    const mStart = monthStart(y, m);
    const mEnd = monthEnd(y, m);
    const mPeriods = computedPeriods.filter(p =>
      (p.shifts || []).some(s => s.date >= mStart && s.date <= mEnd)
    );
    return {
      title: getMonthTitle(offset),
      subtitle: new Date(y, m).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
      breakdown: sumBreakdowns(mPeriods, mStart, mEnd),
      shiftCount: countShifts(mPeriods, mStart, mEnd),
    };
  };

  const getMonthNavLabel = (offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
  };

  // ── Year data at offset ──
  const getYearTitle = (offset) => {
    if (offset === 0) return 'This Year';
    if (offset === -1) return 'Last Year';
    if (offset === 1) return 'Next Year';
    if (offset < 0) return `${now.getFullYear() + offset}`;
    return `${now.getFullYear() + offset} (Projected)`;
  };

  const getYearData = (offset) => {
    const y = now.getFullYear() + offset;
    const yStart = `${y}-01-01`;
    const yEnd = `${y}-12-31`;
    const yPeriods = computedPeriods.filter(p => p.start_date >= yStart && p.start_date <= yEnd);
    return {
      title: getYearTitle(offset),
      subtitle: `Jan 1 – Dec 31, ${y}`,
      breakdown: sumBreakdowns(yPeriods, null, null),
      shiftCount: countShifts(yPeriods, null, null),
    };
  };

  const getYearNavLabel = (offset) => `${now.getFullYear() + offset}`;

  // ── Compute current panels ──
  const mainPeriod = getPeriodData(periodOffset);
  const prevPeriodData = getPeriodData(periodOffset - 1);
  const nextPeriodData = getPeriodData(periodOffset + 1);

  const mainMonth = getMonthData(monthOffset);
  const prevMonthData = getMonthData(monthOffset - 1);
  const nextMonthData = getMonthData(monthOffset + 1);

  const mainYear = getYearData(yearOffset);
  const prevYearData = getYearData(yearOffset - 1);
  const nextYearData = getYearData(yearOffset + 1);

  const periodPanels = [
    showPrevPeriod ? prevPeriodData : null,
    mainPeriod,
    showNextPeriod ? nextPeriodData : null,
  ].filter(Boolean);

  const monthPanels = [
    showPrevMonth ? prevMonthData : null,
    mainMonth,
    showNextMonth ? nextMonthData : null,
  ].filter(Boolean);

  const yearPanels = [
    showPrevYear ? prevYearData : null,
    mainYear,
    showNextYear ? nextYearData : null,
  ].filter(Boolean);

  const gridClass = (n) => {
    if (n === 1) return 'grid-cols-1 max-w-sm';
    if (n === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-3';
  };

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
          hasHospitals={hasHospitals}
        />
      )}

      {/* ── Pay Periods ── */}
      <div>
        <NavHeader
          label={getPeriodNavLabel(periodOffset)}
          onPrev={() => setPeriodOffset(o => o - 1)}
          onNext={() => setPeriodOffset(o => o + 1)}
          showPrev={showPrevPeriod}
          setShowPrev={setShowPrevPeriod}
          showNext={showNextPeriod}
          setShowNext={setShowNextPeriod}
          prevLabel="Previous Period"
          nextLabel="Next Period"
        />
        <div className={`grid gap-6 ${gridClass(periodPanels.length)}`}>
          {periodPanels.map((p, i) => (
            <PaySummaryPanel
              key={i}
              title={p.title}
              subtitle={p.subtitle}
              breakdown={p.breakdown}
              loading={loading}
              taxSettings={settings?.tax_settings}
              shiftCount={p.shiftCount}
              verifiedDeductions={p.verifiedDeductions}
            />
          ))}
        </div>
      </div>

      {/* ── Monthly ── */}
      <div>
        <NavHeader
          label={getMonthNavLabel(monthOffset)}
          onPrev={() => setMonthOffset(o => o - 1)}
          onNext={() => setMonthOffset(o => o + 1)}
          showPrev={showPrevMonth}
          setShowPrev={setShowPrevMonth}
          showNext={showNextMonth}
          setShowNext={setShowNextMonth}
          prevLabel="Previous Month"
          nextLabel="Next Month"
        />
        <div className={`grid gap-6 ${gridClass(monthPanels.length)}`}>
          {monthPanels.map((p, i) => (
            <PaySummaryPanel
              key={i}
              title={p.title}
              subtitle={p.subtitle}
              breakdown={p.breakdown}
              loading={loading}
              taxSettings={settings?.tax_settings}
              shiftCount={p.shiftCount}
            />
          ))}
        </div>
      </div>

      {/* ── Yearly ── */}
      <div>
        <NavHeader
          label={getYearNavLabel(yearOffset)}
          onPrev={() => setYearOffset(o => o - 1)}
          onNext={() => setYearOffset(o => o + 1)}
          showPrev={showPrevYear}
          setShowPrev={setShowPrevYear}
          showNext={showNextYear}
          setShowNext={setShowNextYear}
          prevLabel="Previous Year"
          nextLabel="Next Year"
        />
        <div className={`grid gap-6 ${gridClass(yearPanels.length)}`}>
          {yearPanels.map((p, i) => (
            <PaySummaryPanel
              key={i}
              title={p.title}
              subtitle={p.subtitle}
              breakdown={p.breakdown}
              loading={loading}
              taxSettings={settings?.tax_settings}
              shiftCount={p.shiftCount}
            />
          ))}
        </div>
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
