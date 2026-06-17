import { estimateTaxes, estimateStatutoryDeductions } from '@/lib/taxCalculator';
import { formatCurrency } from '@/lib/utils';

export default function PaySummaryPanel({ title, subtitle, breakdown, loading, taxSettings, shiftCount, verifiedDeductions }) {
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

  const hasVerified = verifiedDeductions && Object.keys(verifiedDeductions).some(k => ['cpp', 'cpp2', 'ei', 'federal_tax', 'provincial_tax'].includes(k) && verifiedDeductions[k] > 0);

  const annualIncome = taxSettings
    ? (taxSettings.annual_federal_income || taxSettings.annual_provincial_income || 0)
    : 0;

  // Use verified deductions when available, otherwise estimate
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

  const netPay = breakdown.gross_pay
    - unionDues
    - (hasTaxes ? taxes.total : 0)
    - (hasStatutory ? statutory.total : 0)
    - (hasVerified && verifiedDeductions.other_deductions ? verifiedDeductions.other_deductions : 0);

  const rows = [
    { label: 'Straight-Time Pay', value: breakdown.straight_time_pay },
    { label: 'Overtime / Stat Pay', value: breakdown.overtime_pay },
    { label: 'Hourly Premiums', value: (breakdown.regular_premium_total || 0) + (breakdown.evening_premium_total || 0) + (breakdown.night_premium_total || 0) + (breakdown.weekend_premium_total || 0) + (breakdown.super_shift_premium_total || 0) + (breakdown.specialty_premium_total || 0) + (breakdown.short_notice_total || 0) + (breakdown.responsibility_total || 0) + (breakdown.preceptor_total || 0) + (breakdown.on_call_total || 0) },
    { label: 'Allowances & Qualifications', value: (breakdown.allowance_total || 0) + (breakdown.qualification_total || 0) },
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
    ...(hasVerified && verifiedDeductions.other_deductions > 0 ? [
      { label: verifiedDeductions.other_label || 'Other Deductions', value: verifiedDeductions.other_deductions, negative: true },
    ] : []),
  ].filter(r => r.value !== 0 && r.value != null);

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
              {r.negative ? '−' : ''}{formatCurrency(r.value)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
        <span className="text-xs text-muted-foreground font-medium">Gross Pay</span>
        <span className="text-sm font-mono font-semibold text-foreground">{formatCurrency(breakdown.gross_pay)}</span>
      </div>
      <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-primary/30">
        <span className="text-sm font-display font-bold text-foreground">{hasVerified ? 'Net Pay (verified)' : 'Net Pay'}</span>
        <span className="text-2xl font-mono font-bold text-primary">{formatCurrency(netPay)}</span>
      </div>
    </div>
  );
}