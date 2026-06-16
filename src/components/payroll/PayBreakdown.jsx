function LineItem({ label, amount, sublabel, negative }) {
  if (amount === 0 || amount == null) return null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <span className="text-sm text-foreground">{label}</span>
        {sublabel && <span className="text-xs text-muted-foreground ml-2">{sublabel}</span>}
      </div>
      <span className={`text-sm font-mono font-medium ${negative ? 'text-destructive' : 'text-foreground'}`}>
        {negative ? '−' : ''}${amount.toFixed(2)}
      </span>
    </div>
  );
}

function SectionHeader({ title }) {
  return <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3 pb-1">{title}</h4>;
}

export default function PayBreakdown({ breakdown, wage }) {
  if (!breakdown) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-1">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="text-base font-display font-semibold text-foreground">Pay Period Breakdown</h3>
        {wage && <span className="text-xs text-muted-foreground">Base wage: ${wage.toFixed(2)}/hr</span>}
      </div>

      <SectionHeader title="Base Pay" />
      <LineItem label="Straight-Time Pay" amount={breakdown.straight_time_pay} sublabel={`${breakdown.regular_hours || 0}h @ $${(wage || breakdown.straight_time_pay / (breakdown.regular_hours || 1)).toFixed(2)}/hr`} />
      <LineItem
        label="Overtime/Stat Pay"
        amount={breakdown.overtime_pay}
        sublabel={(() => {
          const det = breakdown.overtime_detail;
          if (!det) return null;
          const parts = [];
          const labels = { 1.5: '1.5× (OT)', 2: '2× (Day Off/Stat)', 2.5: '2.5× (Super Stat)', 3: '3× (OT on Stat)' };
          for (const [mul, hrs] of Object.entries(det)) {
            if (hrs > 0) parts.push(`${hrs}h @ ${labels[mul] || mul + '×'}`);
          }
          return parts.length > 0 ? parts.join(', ') : null;
        })()}
      />

      <SectionHeader title="Hourly Premiums" />
      <LineItem label="Regular Premium" amount={breakdown.regular_premium_total} sublabel="$2.15/hr on straight time" />
      <LineItem label="Evening Premium" amount={breakdown.evening_premium_total} sublabel="$1.40/hr" />
      <LineItem label="Night Premium" amount={breakdown.night_premium_total} sublabel="$5.00/hr" />
      <LineItem label="Weekend Premium" amount={breakdown.weekend_premium_total} sublabel="$3.50/hr" />
      <LineItem label="Super Shift Premium" amount={breakdown.super_shift_premium_total} sublabel="$1.85/hr" />
      <LineItem label="Short Notice" amount={breakdown.short_notice_total} sublabel="$2.00/hr" />
      <LineItem label="Responsibility Pay" amount={breakdown.responsibility_total} />
      <LineItem label="Preceptor" amount={breakdown.preceptor_total} sublabel="$1.50/hr" />
      <LineItem label="On-Call Pay" amount={breakdown.on_call_total} sublabel={breakdown.on_call_hours ? `${breakdown.on_call_hours}h total` : null} />

      <SectionHeader title="Monthly Allowances & Qualifications" />
      <LineItem label="Allowances (per period)" amount={breakdown.allowance_total} sublabel={`$${breakdown.allowance_monthly}/mo prorated`} />
      <LineItem label="Qualification Diff." amount={breakdown.qualification_total} sublabel={`$${breakdown.qualification_hourly}/hr × ${breakdown.regular_hours || 0} reg hrs`} />

      <SectionHeader title="Deductions" />
      <LineItem label="Union Dues (2% of straight-time)" amount={breakdown.union_dues} negative />

      <div className="flex items-center justify-between pt-4 mt-2 border-t-2 border-primary/30">
        <span className="text-base font-display font-bold text-foreground">Expected Gross Pay</span>
        <span className="text-xl font-mono font-bold text-primary">${breakdown.gross_pay.toFixed(2)}</span>
      </div>
    </div>
  );
}