import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { estimateTaxes, estimateStatutoryDeductions } from '@/lib/taxCalculator';
import { formatCurrency } from '@/lib/utils';
import { usePrivacyMode } from '@/contexts/PrivacyModeContext';

const PIE_COLORS = {
  net: '#14b8a6',
  taxes: '#ef4444',
  statutory: '#6366f1',
  union: '#f59e0b',
};

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{payload[0].name}</p>
      <p className="font-mono text-muted-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export default function PaySummaryPanel({ title, subtitle, breakdown, loading, taxSettings, shiftCount, verifiedDeductions, hidePie }) {
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
        {shiftCount != null && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">{shiftCount} shift{shiftCount !== 1 ? 's' : ''}</p>
        )}
        <p className="text-sm text-muted-foreground mt-4">No data available for this period.</p>
      </div>
    );
  }

  const { privacyMode } = usePrivacyMode();
  const hasVerified = verifiedDeductions && Object.keys(verifiedDeductions).some(k => ['cpp', 'cpp2', 'ei', 'federal_tax', 'provincial_tax'].includes(k) && verifiedDeductions[k] > 0);

  const annualIncome = taxSettings
    ? (taxSettings.annual_federal_income || taxSettings.annual_provincial_income || 0)
    : 0;

  let taxes, statutory;
  if (hasVerified) {
    taxes = {
      federal: verifiedDeductions.federal_tax || 0,
      provincial: verifiedDeductions.provincial_tax || 0,
      total: (verifiedDeductions.federal_tax || 0) + (verifiedDeductions.provincial_tax || 0),
    };
    statutory = {
      cpp: verifiedDeductions.cpp || 0,
      cpp2: verifiedDeductions.cpp2 || 0,
      ei: verifiedDeductions.ei || 0,
      total: (verifiedDeductions.cpp || 0) + (verifiedDeductions.cpp2 || 0) + (verifiedDeductions.ei || 0),
    };
  } else {
    taxes = annualIncome > 0
      ? estimateTaxes(breakdown.gross_pay, taxSettings.annual_provincial_income || 0, taxSettings.annual_federal_income || 0)
      : null;
    statutory = annualIncome > 0
      ? estimateStatutoryDeductions(breakdown.gross_pay, annualIncome, breakdown.straight_time_pay)
      : null;
  }
  const hasTaxes = taxes && taxes.total > 0;
  const hasStatutory = statutory && statutory.total > 0;

  const unionDues = hasVerified && verifiedDeductions.union_dues > 0 ? verifiedDeductions.union_dues : (breakdown.union_dues || 0);
  const otherDeductions = hasVerified && verifiedDeductions.other_deductions ? verifiedDeductions.other_deductions : 0;

  const netPay = breakdown.gross_pay
    - unionDues
    - (hasTaxes ? taxes.total : 0)
    - (hasStatutory ? statutory.total : 0)
    - otherDeductions;

  const rows = [
    { label: 'Straight-Time Pay', value: breakdown.straight_time_pay },
    { label: 'Overtime / Stat Pay', value: breakdown.overtime_pay },
    { label: 'Hourly Premiums', value: (breakdown.regular_premium_total || 0) + (breakdown.evening_premium_total || 0) + (breakdown.night_premium_total || 0) + (breakdown.weekend_premium_total || 0) + (breakdown.super_shift_premium_total || 0) + (breakdown.specialty_premium_total || 0) + (breakdown.short_notice_total || 0) + (breakdown.responsibility_total || 0) + (breakdown.preceptor_total || 0) + (breakdown.on_call_total || 0) },
    { label: 'Allowances & Differentials', value: (breakdown.allowance_total || 0) + (breakdown.qualification_total || 0) },
    { label: 'Union Dues' + (hasVerified && verifiedDeductions.union_dues > 0 ? ' (verified)' : ''), value: unionDues, negative: true },
    ...(hasStatutory ? [
      { label: 'CPP' + (hasVerified ? ' (verified)' : ''), value: statutory.cpp, negative: true },
      ...(statutory.cpp2 > 0 ? [{ label: 'CPP2' + (hasVerified ? ' (verified)' : ''), value: statutory.cpp2, negative: true }] : []),
      { label: 'EI' + (hasVerified ? ' (verified)' : ''), value: statutory.ei, negative: true },
    ] : []),
    ...(hasTaxes ? [
      { label: 'Provincial Tax' + (hasVerified ? ' (verified)' : ' (estimated)'), value: taxes.provincial, negative: true },
      { label: 'Federal Tax' + (hasVerified ? ' (verified)' : ' (estimated)'), value: taxes.federal, negative: true },
    ] : []),
    ...(otherDeductions > 0 ? [
      { label: verifiedDeductions?.other_label || 'Other Deductions', value: otherDeductions, negative: true },
    ] : []),
  ].filter(r => r.value !== 0 && r.value != null);

  // Pie chart data
  const taxTotal = hasTaxes ? taxes.total : 0;
  const statutoryTotal = hasStatutory ? statutory.total : 0;
  const pieData = [
    netPay > 0 && { name: 'Net Pay', value: Math.round(netPay * 100) / 100, color: PIE_COLORS.net },
    taxTotal > 0 && { name: 'Income Tax', value: Math.round(taxTotal * 100) / 100, color: PIE_COLORS.taxes },
    statutoryTotal > 0 && { name: 'CPP / EI', value: Math.round(statutoryTotal * 100) / 100, color: PIE_COLORS.statutory },
    unionDues > 0 && { name: 'Union Dues', value: Math.round(unionDues * 100) / 100, color: PIE_COLORS.union },
    otherDeductions > 0 && { name: 'Other', value: Math.round(otherDeductions * 100) / 100, color: '#94a3b8' },
  ].filter(Boolean);

  const showPie = !hidePie && pieData.length >= 2;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-base font-display font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      {shiftCount != null && (
        <p className="text-xs text-muted-foreground/70 mt-0.5">{shiftCount} shift{shiftCount !== 1 ? 's' : ''}</p>
      )}

      <div className="mt-4 space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{r.label}</span>
            <span className={`text-sm font-mono font-medium ${r.negative ? 'text-destructive' : 'text-foreground'}`}>
              {privacyMode ? '••••••' : `${r.negative ? '−' : ''}${formatCurrency(r.value)}`}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
        <span className="text-xs text-muted-foreground font-medium">Gross Pay</span>
        <span className="text-sm font-mono font-semibold text-foreground">{privacyMode ? '••••••' : formatCurrency(breakdown.gross_pay)}</span>
      </div>
      <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-primary/30">
        <span className="text-sm font-display font-bold text-foreground">{hasVerified ? 'Net Pay (verified)' : 'Net Pay'}</span>
        <span className="text-2xl font-mono font-bold text-primary">{privacyMode ? '••••••' : formatCurrency(netPay)}</span>
      </div>

      {showPie && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground font-medium mb-2">Pay Breakdown</p>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={26}
                    outerRadius={42}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              {pieData.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-muted-foreground truncate">{entry.name}</span>
                  <span className="text-xs font-mono font-medium text-foreground ml-auto pl-2 flex-shrink-0">
                    {privacyMode ? '—' : `${breakdown.gross_pay > 0 ? Math.round(entry.value / breakdown.gross_pay * 100) : 0}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
