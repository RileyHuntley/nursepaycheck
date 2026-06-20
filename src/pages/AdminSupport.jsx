import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PaySummaryPanel from '@/components/payroll/PaySummaryPanel';
import { calculatePeriodBreakdown, getCurrentPayPeriodDates } from '@/lib/premiumCalculator';
import { ArrowLeft, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const sumBreakdowns = (periodsList, settings) => {
  if (periodsList.length === 0 || !settings) return null;
  const monthsWithShifts = new Set();
  for (const p of periodsList) {
    for (const shift of (p.shifts || [])) {
      monthsWithShifts.add(shift.date.substring(0, 7));
    }
  }
  const monthlyAllowance = (settings.active_allowances || []).reduce((sum, k) => sum + (settings.allowance_rates?.[k] || 0), 0);
  const allowanceTotal = monthsWithShifts.size * monthlyAllowance;
  const base = periodsList.reduce((acc, p) => {
    const b = calculatePeriodBreakdown(p.shifts || [], settings);
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
  base.allowance_total = allowanceTotal;
  base.allowance_monthly = monthlyAllowance;
  const annualQualTotal = (settings.active_qualifications || []).reduce((sum, k) => sum + (settings.qualification_rates?.[k] || 0), 0) * 12;
  base.qualification_total = monthsWithShifts.size * (annualQualTotal / 12);
  base.qualification_annual = annualQualTotal;
  base.qualification_hourly = annualQualTotal / 1950;
  base.gross_pay = (base.gross_pay || 0) + allowanceTotal + base.qualification_total;
  return base;
};

export default function AdminSupport() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    setError(null);
    base44.functions.invoke('getUserData', { userId })
      .then(res => {
        setData(res.data);
        setLoading(false);
        setRefreshing(false);
      })
      .catch(e => {
        setError(e.response?.data?.error || e.message || 'Failed to load user data');
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => { fetchData(true); }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
        <p className="text-sm text-destructive">{error}</p>
        <Link to="/admin" className="text-sm text-primary hover:underline inline-block">← Back to Admin</Link>
      </div>
    );
  }

  const { user: targetUser, settings, periods } = data;
  const computedPeriods = (periods || []).map(p => ({
    ...p,
    computedBreakdown: (p.shifts?.length && settings)
      ? (p.breakdown || calculatePeriodBreakdown(p.shifts, settings))
      : null,
  }));

  const totalShifts = periods.reduce((sum, p) => sum + (p.shifts?.length || 0), 0);
  const { start_date: curStart, end_date: curEnd } = getCurrentPayPeriodDates();
  const _today = new Date();
  const todayStr = `${_today.getFullYear()}-${String(_today.getMonth()+1).padStart(2,'0')}-${String(_today.getDate()).padStart(2,'0')}`;

  const currentPeriod = computedPeriods.find(p => p.start_date === curStart && p.end_date === curEnd);
  const pastPeriod = computedPeriods.filter(p => p.end_date < todayStr).sort((a, b) => b.end_date.localeCompare(a.end_date))[0] || null;
  const nextStart = addDays(curStart, 14);
  const nextEnd = addDays(curEnd, 14);
  const nextPeriod = computedPeriods.find(p => p.start_date === nextStart && p.end_date === nextEnd) || null;

  const ytdPeriods = computedPeriods.filter(p => p.start_date >= `${new Date().getFullYear()}-01-01`);
  const ytdBreakdown = sumBreakdowns(ytdPeriods, settings);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">
            {targetUser?.full_name || targetUser?.display_name || targetUser?.email || 'Unknown User'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {targetUser?.email} · {totalShifts} shifts · {periods.length} pay periods
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => fetchData(false)} disabled={refreshing} className="ml-auto">
          <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {totalShifts === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">This user has no shifts logged yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PaySummaryPanel
              title="Past Pay Period"
              subtitle={pastPeriod ? pastPeriod.name : 'No data'}
              breakdown={pastPeriod?.computedBreakdown}
              taxSettings={settings?.tax_settings}
              shiftCount={pastPeriod?.shifts?.length || 0}
              verifiedDeductions={pastPeriod?.verified_deductions}
            />
            <PaySummaryPanel
              title="Pay Period"
              subtitle={currentPeriod ? currentPeriod.name : 'No pay period'}
              breakdown={currentPeriod?.computedBreakdown}
              taxSettings={settings?.tax_settings}
              shiftCount={currentPeriod?.shifts?.length || 0}
            />
            <PaySummaryPanel
              title="Next Pay Period"
              subtitle={nextPeriod ? nextPeriod.name : 'Not created'}
              breakdown={nextPeriod?.computedBreakdown}
              taxSettings={settings?.tax_settings}
              shiftCount={nextPeriod?.shifts?.length || 0}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PaySummaryPanel
              title="Year to Date"
              subtitle={`Jan 1 – Today`}
              breakdown={ytdBreakdown}
              taxSettings={settings?.tax_settings}
              shiftCount={ytdPeriods.reduce((sum, p) => sum + (p.shifts || []).filter(s => s.date <= todayStr).length, 0)}
            />
          </div>
        </>
      )}
    </div>
  );
}