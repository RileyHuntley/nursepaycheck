import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PaySummaryPanel from '@/components/payroll/PaySummaryPanel';
import PayBreakdownPie from '@/components/payroll/PayBreakdownPie';
import EarningsTrendChart from '@/components/payroll/EarningsTrendChart';
import { calculatePeriodBreakdown, getCurrentPayPeriodDates, getFirstPeriodsOfMonths, shiftSpanHours } from '@/lib/premiumCalculator';
import EditShiftDialog from '@/components/payroll/EditShiftDialog';
import { Button } from '@/components/ui/button';
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, CalendarCheck, Stethoscope } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { usePrivacyMode } from '@/contexts/PrivacyModeContext';
import PrivacyToggle from '@/components/payroll/PrivacyToggle';
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
  const { privacyMode } = usePrivacyMode();
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

  // Trend chart view toggles
  const [trendMonthsView, setTrendMonthsView] = useState('past');
  const [trendPeriodsView, setTrendPeriodsView] = useState('past');

  // Shift editing
  const [editingShift, setEditingShift] = useState(null); // { data, _periodId, _shiftIdx }

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
    if (offset === 0) return 'Pay Period';
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

  // ── Quick stats ──
  const pendingShiftCount = periods.reduce((sum, p) => {
    return sum + (p.shifts || []).filter(s => {
      if (s.status === 'verified') return false;
      if (!s.date || s.date > todayStr) return false;
      return true;
    }).length;
  }, 0);

  // Next pay date: earliest VCH pay date that is in the future
  const nextPayDate = (() => {
    // Check pay date for current period, then next
    const candidates = [addDays(curStart, -14), curStart, addDays(curStart, 14)];
    for (const start of candidates) {
      const pd = getVCHPayDate(start);
      if (pd && pd >= todayStr) return pd;
    }
    return null;
  })();

  const daysUntilPay = nextPayDate
    ? Math.round((new Date(nextPayDate + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 86400000)
    : null;

  // ── Shift edit handlers ──
  const periodMap = Object.fromEntries(periods.map(p => [p.id, p]));
  const firstPeriodsSet = firstPeriodsOfMonth;

  const updateShift = async (shiftData) => {
    if (!editingShift) return;
    const period = periodMap[editingShift._periodId];
    if (!period) return;
    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === editingShift._shiftIdx ? { ...shiftData } : s
    );
    const breakdown = settings
      ? calculatePeriodBreakdown(updatedShifts, settings, firstPeriodsSet.has(period.start_date))
      : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown } : {}),
    });
    setEditingShift(null);
  };

  const deleteShift = async () => {
    if (!editingShift) return;
    const period = periodMap[editingShift._periodId];
    if (!period) return;
    const updatedShifts = (period.shifts || []).filter((_, i) => i !== editingShift._shiftIdx);
    const breakdown = settings
      ? calculatePeriodBreakdown(updatedShifts, settings, firstPeriodsSet.has(period.start_date))
      : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown } : {}),
    });
    setEditingShift(null);
  };

  // ── Upcoming shifts (next 4 across all periods) ──
  const upcomingShifts = periods
    .flatMap(p => (p.shifts || []).map((s, idx) => ({ ...s, _periodId: p.id, _shiftIdx: idx, periodName: p.name })))
    .filter(s => s.date && s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || ''))
    .slice(0, 4);

  const SHIFT_TYPE_LABELS = {
    casual: 'Casual', regular: 'Regular', stat_holiday: 'Stat Holiday',
    orientation: 'Orientation', education: 'Education', isn: 'ISN',
    vacation: 'Vacation', paid_vacation: 'Paid Vacation', sick: 'Sick',
    paid_sick: 'Paid Sick', unpaid_vacation: 'Unpaid Leave', unpaid_sick: 'Unpaid Sick',
    special_leave: 'Special Leave', pdo_pst: 'PDO/PST', other_leave: 'Other Leave',
    student_practicum: 'Student Practicum',
  };

  // ── Current period progress ──
  const curPeriodDayElapsed = Math.min(14, Math.max(0,
    Math.round((new Date(todayStr + 'T12:00:00') - new Date(curStart + 'T12:00:00')) / 86400000) + 1
  ));
  const curPeriodRecord = computedPeriods.find(p => p.start_date === curStart && p.end_date === curEnd);
  const curPeriodShifts = curPeriodRecord?.shifts || [];
  const workedShifts = curPeriodShifts.filter(s => s.date && s.date <= todayStr);
  const workedBreakdown = workedShifts.length > 0 && settings
    ? calculatePeriodBreakdown(workedShifts, settings, firstPeriodsSet.has(curStart))
    : null;
  const curPeriodGross = workedBreakdown?.gross_pay || 0;

  const gridClass = (n) => {
    if (n === 1) return 'grid-cols-1 md:grid-cols-2';
    if (n === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-3';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Dashboard</h2>
            <PrivacyToggle />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Pay period summaries at a glance</p>
        </div>
        <Link to="/pay-period">
          <Button size="sm" className="bg-primary text-primary-foreground">
            <CalendarPlus className="w-4 h-4 mr-2" />
            Pay Period
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

      {/* ── Quick Stats Bar ── */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/shift-log" className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4 hover:border-primary/40 transition-colors group">
            <div className={`p-2.5 rounded-lg ${pendingShiftCount > 0 ? 'bg-amber-500/10' : 'bg-muted'}`}>
              <Clock className={`w-5 h-5 ${pendingShiftCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">Shifts Pending Verification</p>
              {pendingShiftCount > 0 ? (
                <p className="text-2xl font-mono font-bold text-amber-500 leading-tight">
                  {pendingShiftCount}
                  <span className="text-sm font-sans font-normal text-muted-foreground ml-1.5">
                    shift{pendingShiftCount !== 1 ? 's' : ''}
                  </span>
                </p>
              ) : (
                <p className="text-sm font-medium text-muted-foreground mt-0.5">All caught up</p>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <CalendarCheck className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">Next Pay Date</p>
              {nextPayDate ? (
                <p className="text-2xl font-mono font-bold text-primary leading-tight">
                  {new Date(nextPayDate + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  <span className="text-sm font-sans font-normal text-muted-foreground ml-1.5">
                    {daysUntilPay === 0 ? 'today' : daysUntilPay === 1 ? 'tomorrow' : `in ${daysUntilPay} days`}
                  </span>
                </p>
              ) : (
                <p className="text-sm font-medium text-muted-foreground mt-0.5">Not scheduled</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Upcoming Shifts + Period Progress ── */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Upcoming shifts */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Upcoming Shifts</h3>
              <Link to="/shift-log" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {upcomingShifts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No upcoming shifts logged.</p>
            ) : (
              <div className="divide-y divide-border">
                {upcomingShifts.map((s, i) => {
                  const d = new Date(s.date + 'T12:00:00');
                  const totalHours = s.start_time && s.end_time
                    ? shiftSpanHours(s.start_time, s.end_time)
                    : s.paid_hours;
                  return (
                    <button
                      key={i}
                      onClick={() => setEditingShift({ data: s, _periodId: s._periodId, _shiftIdx: s._shiftIdx })}
                      className="w-full flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 text-left hover:bg-muted/40 rounded-lg px-1 -mx-1 transition-colors"
                    >
                      <div className="text-center shrink-0 w-10">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase leading-none">
                          {d.toLocaleDateString('en-CA', { month: 'short' })}
                        </p>
                        <p className="text-lg font-mono font-bold text-foreground leading-tight">
                          {d.getDate()}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-none">
                          {d.toLocaleDateString('en-CA', { weekday: 'short' })}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {SHIFT_TYPE_LABELS[s.shift_type] || s.shift_type || 'Shift'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[s.hospital, s.unit].filter(Boolean).join(' · ') || s.periodName || '—'}
                        </p>
                      </div>
                      {(s.start_time || totalHours != null) && (
                        <div className="text-right shrink-0">
                          {s.start_time && (
                            <p className="text-xs font-mono text-muted-foreground">{s.start_time}</p>
                          )}
                          {totalHours != null && (
                            <p className="text-xs font-mono text-muted-foreground">{totalHours}h</p>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Current period progress */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Current Period</h3>
              <span className="text-xs text-muted-foreground">{fmtDate(curStart)} – {fmtDate(curEnd)}</span>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Day {curPeriodDayElapsed} of 14</span>
                <span>{Math.round((curPeriodDayElapsed / 14) * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${(curPeriodDayElapsed / 14) * 100}%` }}
                />
              </div>
            </div>
            {curPeriodShifts.length > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Shift {workedShifts.length} of {curPeriodShifts.length}</span>
                  <span>{Math.round((workedShifts.length / curPeriodShifts.length) * 100)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(workedShifts.length / curPeriodShifts.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Gross so far</p>
              {curPeriodGross > 0 ? (
                <p className="text-2xl font-mono font-bold text-primary leading-tight">
                  {privacyMode ? '••••••' : formatCurrency(curPeriodGross)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">No shifts yet</p>
              )}
            </div>
          </div>
        </div>
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
          prevLabel="Compare Back"
          nextLabel="Compare Forward"
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
              hidePie={periodPanels.length === 1}
            />
          ))}
          {periodPanels.length === 1 && (
            <PayBreakdownPie
              breakdown={mainPeriod.breakdown}
              taxSettings={settings?.tax_settings}
              verifiedDeductions={mainPeriod.verifiedDeductions}
            />
          )}
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
          prevLabel="Compare Back"
          nextLabel="Compare Forward"
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
              hidePie={monthPanels.length === 1}
            />
          ))}
          {monthPanels.length === 1 && (
            <PayBreakdownPie
              breakdown={mainMonth.breakdown}
              taxSettings={settings?.tax_settings}
            />
          )}
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
              hidePie={yearPanels.length === 1}
            />
          ))}
          {yearPanels.length === 1 && (
            <PayBreakdownPie
              breakdown={mainYear.breakdown}
              taxSettings={settings?.tax_settings}
            />
          )}
        </div>
      </div>

      {/* ── Trend Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly trend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              Earnings Trend — {trendMonthsView === 'past' ? 'Last' : 'Next'} 6 Months
            </h3>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setTrendMonthsView('past')}
                className={`p-1.5 rounded-lg transition-colors ${trendMonthsView === 'past' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}
                aria-label="Past months"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground w-10 text-center">
                {trendMonthsView === 'past' ? 'Past' : 'Future'}
              </span>
              <button
                onClick={() => setTrendMonthsView('future')}
                className={`p-1.5 rounded-lg transition-colors ${trendMonthsView === 'future' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}
                aria-label="Future months"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <EarningsTrendChart
            periods={computedPeriods}
            settings={settings}
            chartType={trendMonthsView === 'past' ? 'months_past' : 'months_future'}
            bare
          />
        </div>

        {/* Pay period trend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              Earnings Trend — {trendPeriodsView === 'past' ? 'Last' : 'Next'} 6 Pay Periods
            </h3>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setTrendPeriodsView('past')}
                className={`p-1.5 rounded-lg transition-colors ${trendPeriodsView === 'past' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}
                aria-label="Past periods"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground w-10 text-center">
                {trendPeriodsView === 'past' ? 'Past' : 'Future'}
              </span>
              <button
                onClick={() => setTrendPeriodsView('future')}
                className={`p-1.5 rounded-lg transition-colors ${trendPeriodsView === 'future' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}
                aria-label="Future periods"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <EarningsTrendChart
            periods={computedPeriods}
            settings={settings}
            chartType={trendPeriodsView === 'past' ? 'periods_past' : 'periods_future'}
            bare
          />
        </div>
      </div>

      <EditShiftDialog
        editingShift={editingShift}
        settings={settings}
        onSubmit={updateShift}
        onClose={() => setEditingShift(null)}
        onDelete={deleteShift}
      />
    </div>
  );
}
