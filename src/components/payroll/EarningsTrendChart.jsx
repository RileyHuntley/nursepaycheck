import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatValue = (v) => `$${(v || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const items = payload.filter(p => p.value > 0);
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {items.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-mono font-medium text-foreground">{formatValue(entry.value)}</span>
        </div>
      ))}
      {items.length > 1 && (
        <div className="flex items-center justify-between gap-4 pt-1.5 mt-1 border-t border-border">
          <span className="font-semibold text-foreground">Total</span>
          <span className="font-mono font-bold text-primary">
            {formatValue(items.reduce((s, p) => s + (p.value || 0), 0))}
          </span>
        </div>
      )}
    </div>
  );
};

/** Sum all premium totals from a breakdown into one value */
const premiumTotal = (b) =>
  (b?.evening_premium_total || 0) +
  (b?.night_premium_total || 0) +
  (b?.weekend_premium_total || 0) +
  (b?.super_shift_premium_total || 0) +
  (b?.regular_premium_total || 0) +
  (b?.short_notice_total || 0) +
  (b?.responsibility_total || 0) +
  (b?.preceptor_total || 0) +
  (b?.specialty_premium_total || 0) +
  (b?.on_call_total || 0);

const STACK_KEYS = ['straightTime', 'overtime', 'premiums', 'allowances'];

const STACK_CONFIG = [
  { key: 'straightTime', name: 'Straight Time', fill: 'hsl(var(--chart-3))' },
  { key: 'overtime',    name: 'Overtime / Stat', fill: 'hsl(var(--chart-2))' },
  { key: 'premiums',    name: 'Premiums', fill: 'hsl(var(--chart-4))' },
  { key: 'allowances',  name: 'Allowances & Quals', fill: 'hsl(var(--chart-5))' },
];

/**
 * chartType:
 *  'months_past'     – last 6 calendar months
 *  'months_future'   – next 6 calendar months
 *  'periods_past'    – last 6 completed pay periods
 *  'periods_future'  – next 6 pay periods (including current/upcoming)
 */
export default function EarningsTrendChart({ periods, settings, chartType, title }) {
  if (!periods?.length || !settings) return null;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  let data = [];
  let hasData = false;

  if (chartType === 'months_past' || chartType === 'months_future') {
    // ── Monthly charts: prorate period components by shift hours ──
    const monthlyAccum = {};
    const isPast = chartType === 'months_past';

    // Generate the 6 target months
    for (let i = 0; i < 6; i++) {
      const m = isPast
        ? new Date(now.getFullYear(), now.getMonth() - i, 1)
        : new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      monthlyAccum[key] = { straightTime: 0, overtime: 0, premiums: 0, allowanceMon: 0, qualification: 0, hours: 0 };
    }

    // Oldest month in the range — only include shifts on or after this date
    const oldestMonth = isPast
      ? new Date(now.getFullYear(), now.getMonth() - 5, 1)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const cutoffDate = oldestMonth.toISOString().split('T')[0];

    for (const p of periods) {
      const shifts = p.shifts || [];
      if (!shifts.length) continue;
      const b = p.computedBreakdown || p.breakdown;
      if (!b || b.gross_pay <= 0) continue;

      const monthHours = {};
      let totalHours = 0;
      let relevant = false;

      for (const s of shifts) {
        if (!s.date || !s.paid_hours) continue;
        if (s.date >= cutoffDate) relevant = true;
        const m = s.date.substring(0, 7);
        if (monthlyAccum.hasOwnProperty(m)) {
          monthHours[m] = (monthHours[m] || 0) + (s.paid_hours || 0);
          totalHours += (s.paid_hours || 0);
        }
      }

      if (!relevant || totalHours === 0) continue;

      // Prorate each component by hours share
      for (const [m, hrs] of Object.entries(monthHours)) {
        const share = hrs / totalHours;
        monthlyAccum[m].straightTime += (b.straight_time_pay || 0) * share;
        monthlyAccum[m].overtime    += (b.overtime_pay || 0) * share;
        monthlyAccum[m].premiums    += premiumTotal(b) * share;
        monthlyAccum[m].allowanceMon += (b.allowance_total || 0) * share;
        monthlyAccum[m].qualification += (b.qualification_total || 0) * share;
        monthlyAccum[m].hours       += hrs;
      }
    }

    // Apply monthly allowance cap: full monthly amount if shifts exist in that month
    const monthlyAllowanceRate = (settings.active_allowances || []).reduce((sum, k) => sum + (settings.allowance_rates?.[k] || 0), 0);

    data = Object.entries(monthlyAccum)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, acc]) => {
        const [y, m] = key.split('-');
        // Full monthly allowance if any shifts in month, plus prorated qualifications
        const allowance = acc.hours > 0
          ? monthlyAllowanceRate + acc.qualification
          : acc.qualification;
        return {
          label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`,
          straightTime: Math.round(acc.straightTime * 100) / 100,
          overtime:     Math.round(acc.overtime * 100) / 100,
          premiums:     Math.round(acc.premiums * 100) / 100,
          allowances:   Math.round(allowance * 100) / 100,
        };
      });

  } else {
    // ── Period charts: use breakdown directly ──
    const sorted = (chartType === 'periods_past'
      ? periods.filter(p => p.end_date < todayStr).sort((a, b) => b.end_date.localeCompare(a.end_date)).slice(0, 6).reverse()
      : periods.filter(p => p.start_date >= todayStr || p.end_date >= todayStr).sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 6))
      .filter(p => (p.shifts?.length || 0) > 0);

    data = sorted.map(p => {
      const b = p.computedBreakdown || p.breakdown || {};
      const startDate = new Date(p.start_date + 'T12:00:00');
      const shortLabel = startDate.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
      return {
        label: shortLabel,
        straightTime: Math.round((b.straight_time_pay || 0) * 100) / 100,
        overtime:     Math.round((b.overtime_pay || 0) * 100) / 100,
        premiums:     Math.round(premiumTotal(b) * 100) / 100,
        allowances:   Math.round(((b.allowance_total || 0) + (b.qualification_total || 0)) * 100) / 100,
      };
    });
  }

  hasData = data.some(d => STACK_KEYS.some(k => d[k] > 0));
  if (!hasData) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title || 'Earnings Trend'}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false} tickLine={false} interval={0}
            angle={chartType === 'periods_past' || chartType === 'periods_future' ? -35 : 0}
            textAnchor={chartType === 'periods_past' || chartType === 'periods_future' ? 'end' : 'middle'}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => `$${v.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
          {STACK_CONFIG.map(({ key, name, fill }) => (
            <Bar
              key={key}
              dataKey={key}
              name={name}
              fill={fill}
              stackId="earnings"
              radius={key === 'allowances' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}