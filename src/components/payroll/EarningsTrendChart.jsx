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

export default function EarningsTrendChart({ periods, settings }) {
  if (!periods?.length || !settings) return null;

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

  // Build monthly aggregates — bucket by each shift's date, not pay period start
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

    // Group shifts by month and sum paid_hours per month
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

    // Skip periods with no shifts in the 6-month window
    if (!hasRecentShift || totalHours === 0) continue;

    // Distribute period gross proportionally by paid hours per month
    for (const [m, hrs] of Object.entries(monthHours)) {
      monthlyMap[m] += gross * (hrs / totalHours);
    }
  }

  const data = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, gross]) => {
      const [y, m] = key.split('-');
      return { month: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`, gross: Math.round(gross * 100) / 100 };
    });

  const hasData = data.some(d => d.gross > 0);
  if (!hasData) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Earnings Trend — Last 6 Months</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
          <Bar dataKey="gross" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}