import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import PaySummaryPanel from '@/components/payroll/PaySummaryPanel';
import { calculatePeriodBreakdown, getCurrentPayPeriodDates } from '@/lib/premiumCalculator';
import { Button } from '@/components/ui/button';
import { CalendarPlus } from 'lucide-react';

export default function Dashboard() {
  const [settings, setSettings] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsList, periodList] = await Promise.all([
        base44.entities.Settings.list(),
        base44.entities.PayPeriod.list('-start_date', 100),
      ]);
      setSettings(settingsList[0] || null);
      setPeriods(periodList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time subscriptions
  useEffect(() => {
    const unsub1 = base44.entities.Settings.subscribe(() => loadData());
    const unsub2 = base44.entities.PayPeriod.subscribe(() => loadData());
    return () => { unsub1(); unsub2(); };
  }, [loadData]);

  const computedPeriods = periods.map(p => ({
    ...p,
    computedBreakdown: p.breakdown || (settings && p.shifts?.length ? calculatePeriodBreakdown(p.shifts, settings) : null),
  }));

  // Most recent pay period
  const latest = computedPeriods[0];

  // Current month totals
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const monthPeriods = computedPeriods.filter(p => p.start_date >= monthStart && p.start_date <= monthEnd);

  const monthBreakdown = monthPeriods.length > 0 ? monthPeriods.reduce((acc, p) => {
    const b = p.computedBreakdown;
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
      on_call_total: (acc.on_call_total || 0) + b.on_call_total,
      allowance_total: (acc.allowance_total || 0) + b.allowance_total,
      qualification_total: (acc.qualification_total || 0) + b.qualification_total,
      union_dues: (acc.union_dues || 0) + b.union_dues,
      gross_pay: (acc.gross_pay || 0) + b.gross_pay,
    };
  }, {}) : null;

  // Year-to-date totals
  const yearStart = `${now.getFullYear()}-01-01`;
  const ytdPeriods = computedPeriods.filter(p => p.start_date >= yearStart);
  const ytdBreakdown = ytdPeriods.length > 0 ? ytdPeriods.reduce((acc, p) => {
    const b = p.computedBreakdown;
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
      on_call_total: (acc.on_call_total || 0) + b.on_call_total,
      allowance_total: (acc.allowance_total || 0) + b.allowance_total,
      qualification_total: (acc.qualification_total || 0) + b.qualification_total,
      union_dues: (acc.union_dues || 0) + b.union_dues,
      gross_pay: (acc.gross_pay || 0) + b.gross_pay,
    };
  }, {}) : null;

  const monthLabel = now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PaySummaryPanel
          title="Latest Pay Period"
          subtitle={latest ? latest.name : 'No pay periods yet'}
          breakdown={latest?.computedBreakdown}
          loading={loading}
        />
        <PaySummaryPanel
          title="Current Month"
          subtitle={monthLabel}
          breakdown={monthBreakdown}
          loading={loading}
        />
        <PaySummaryPanel
          title="Year to Date"
          subtitle={`Jan 1 – Present (${ytdPeriods.length} periods)`}
          breakdown={ytdBreakdown}
          loading={loading}
        />
      </div>
    </div>
  );
}