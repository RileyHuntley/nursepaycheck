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

  // Build monthly aggregates
  const monthlyMap = {};
  for (let i = 0; i < 6; i++) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap[key] = 0;
  }

  for (const p of periods) {
    if (p.start_date < sixMonthsAgo.toISOString().split('T')[0]) continue;
    const b = p.computedBreakdown || p.breakdown;
    const gross = b?.gross_pay;
    if (gross != null) {
      const startMonth = p.start_date.substring(0, 7);
      if (monthlyMap.hasOwnProperty(startMonth)) {
        monthlyMap[startMonth] += gross;
      }
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