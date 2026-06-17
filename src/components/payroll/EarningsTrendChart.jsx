import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary font-mono font-medium">
        ${payload[0].value.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
};

/**
 * chartType:
 *  'months_past'     – last 6 calendar months (existing)
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

  if (chartType === 'months_past') {
    // Last 6 calendar months (existing logic)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];
    const monthlyMap = {};
    for (let i = 0; i < 6; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = 0;
    }
    for (const p of periods) {
      const shifts = p.shifts || [];
      if (!shifts.length) continue;
      const b = p.computedBreakdown || p.breakdown;
      const gross = b?.gross_pay;
      if (gross == null || gross <= 0) continue;
      const monthHours = {};
      let totalHours = 0;
      let hasRecentShift = false;
      for (const s of shifts) {
        if (!s.date || !s.paid_hours) continue;
        if (s.date >= sixMonthsAgoStr) hasRecentShift = true;
        const m = s.date.substring(0, 7);
        if (monthlyMap.hasOwnProperty(m)) {
          monthHours[m] = (monthHours[m] || 0) + (s.paid_hours || 0);
          totalHours += (s.paid_hours || 0);
        }
      }
      if (!hasRecentShift || totalHours === 0) continue;
      for (const [m, hrs] of Object.entries(monthHours)) {
        monthlyMap[m] += gross * (hrs / totalHours);
      }
    }
    data = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, gross]) => {
        const [y, m] = key.split('-');
        return { label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`, gross: Math.round(gross * 100) / 100 };
      });

  } else if (chartType === 'months_future') {
    // Next 6 calendar months — based on scheduled shifts (including upcoming)
    const monthlyMap = {};
    for (let i = 0; i < 6; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = 0;
    }
    const futureStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    for (const p of periods) {
      const shifts = p.shifts || [];
      if (!shifts.length) continue;
      const b = p.computedBreakdown || p.breakdown;
      const gross = b?.gross_pay;
      if (gross == null || gross <= 0) continue;
      const monthHours = {};
      let totalHours = 0;
      let hasFutureShift = false;
      for (const s of shifts) {
        if (!s.date || !s.paid_hours) continue;
        if (s.date >= futureStart) hasFutureShift = true;
        const m = s.date.substring(0, 7);
        if (monthlyMap.hasOwnProperty(m)) {
          monthHours[m] = (monthHours[m] || 0) + (s.paid_hours || 0);
          totalHours += (s.paid_hours || 0);
        }
      }
      if (!hasFutureShift || totalHours === 0) continue;
      for (const [m, hrs] of Object.entries(monthHours)) {
        monthlyMap[m] += gross * (hrs / totalHours);
      }
    }
    data = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, gross]) => {
        const [y, m] = key.split('-');
        return { label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`, gross: Math.round(gross * 100) / 100 };
      });

  } else if (chartType === 'periods_past') {
    // Last 6 completed pay periods
    const past = periods
      .filter(p => p.end_date < todayStr)
      .sort((a, b) => b.end_date.localeCompare(a.end_date))
      .slice(0, 6)
      .reverse();
    data = past.map(p => {
      const b = p.computedBreakdown || p.breakdown;
      const gross = b?.gross_pay || 0;
      return { label: p.name, gross: Math.round(gross * 100) / 100 };
    });

  } else if (chartType === 'periods_future') {
    // Next 6 pay periods (including current)
    const future = periods
      .filter(p => p.start_date >= todayStr || p.end_date >= todayStr)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 6);
    data = future.map(p => {
      const b = p.computedBreakdown || p.breakdown;
      const gross = b?.gross_pay || 0;
      return { label: p.name, gross: Math.round(gross * 100) / 100 };
    });
  }

  hasData = data.some(d => d.gross > 0);
  if (!hasData) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title || 'Earnings Trend'}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={0} angle={chartType === 'periods_past' || chartType === 'periods_future' ? -35 : 0} textAnchor={chartType === 'periods_past' || chartType === 'periods_future' ? 'end' : 'middle'} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
          <Bar dataKey="gross" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}