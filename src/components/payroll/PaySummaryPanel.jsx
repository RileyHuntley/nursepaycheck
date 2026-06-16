export default function PaySummaryPanel({ title, subtitle, breakdown, loading }) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
        <div className="h-5 bg-muted rounded w-32 mb-2" />
        <div className="h-4 bg-muted rounded w-48 mb-4" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 bg-muted rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!breakdown) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-base font-display font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        <p className="text-sm text-muted-foreground mt-4">No data available for this period.</p>
      </div>
    );
  }

  const rows = [
    { label: 'Straight-Time Pay', value: breakdown.straight_time_pay },
    { label: 'Overtime / Stat Pay', value: breakdown.overtime_pay },
    { label: 'Hourly Premiums', value: (breakdown.regular_premium_total || 0) + (breakdown.evening_premium_total || 0) + (breakdown.night_premium_total || 0) + (breakdown.weekend_premium_total || 0) + (breakdown.super_shift_premium_total || 0) + (breakdown.short_notice_total || 0) + (breakdown.responsibility_total || 0) + (breakdown.preceptor_total || 0) + (breakdown.on_call_total || 0) },
    { label: 'Allowances & Qualifications', value: (breakdown.allowance_total || 0) + (breakdown.qualification_total || 0) },
    { label: 'Union Dues (−2%)', value: breakdown.union_dues, negative: true },
  ].filter(r => r.value !== 0 && r.value != null);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-base font-display font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}

      <div className="mt-4 space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{r.label}</span>
            <span className={`text-sm font-mono font-medium ${r.negative ? 'text-destructive' : 'text-foreground'}`}>
              {r.negative ? '−' : ''}${r.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 mt-3 border-t-2 border-primary/30">
        <span className="text-sm font-display font-bold text-foreground">Gross Pay</span>
        <span className="text-2xl font-mono font-bold text-primary">${breakdown.gross_pay.toFixed(2)}</span>
      </div>
    </div>
  );
}