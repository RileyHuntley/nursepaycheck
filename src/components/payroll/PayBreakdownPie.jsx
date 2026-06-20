import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { estimateTaxes, estimateStatutoryDeductions } from '@/lib/taxCalculator';
import { formatCurrency } from '@/lib/utils';
import { Link } from 'react-router-dom';
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

export default function PayBreakdownPie({ breakdown, taxSettings, verifiedDeductions }) {
  if (!breakdown) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No data</p>
      </div>
    );
  }

  const { privacyMode } = usePrivacyMode();
  const hasVerified = verifiedDeductions && Object.keys(verifiedDeductions).some(
    k => ['cpp', 'cpp2', 'ei', 'federal_tax', 'provincial_tax'].includes(k) && verifiedDeductions[k] > 0
  );

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
      ? estimateTaxes(breakdown.gross_pay, taxSettings?.annual_provincial_income || 0, taxSettings?.annual_federal_income || 0)
      : null;
    statutory = annualIncome > 0
      ? estimateStatutoryDeductions(breakdown.gross_pay, annualIncome, breakdown.straight_time_pay)
      : null;
  }

  const hasTaxes = taxes && taxes.total > 0;
  const hasStatutory = statutory && statutory.total > 0;
  const unionDues = hasVerified && verifiedDeductions.union_dues > 0 ? verifiedDeductions.union_dues : (breakdown.union_dues || 0);
  const otherDeductions = hasVerified && verifiedDeductions?.other_deductions ? verifiedDeductions.other_deductions : 0;

  const netPay = breakdown.gross_pay
    - unionDues
    - (hasTaxes ? taxes.total : 0)
    - (hasStatutory ? statutory.total : 0)
    - otherDeductions;

  const taxTotal = hasTaxes ? taxes.total : 0;
  const statutoryTotal = hasStatutory ? statutory.total : 0;

  const pieData = [
    netPay > 0 && { name: 'Net Pay', value: Math.round(netPay * 100) / 100, color: PIE_COLORS.net },
    taxTotal > 0 && { name: 'Income Tax', value: Math.round(taxTotal * 100) / 100, color: PIE_COLORS.taxes },
    statutoryTotal > 0 && { name: 'CPP / EI', value: Math.round(statutoryTotal * 100) / 100, color: PIE_COLORS.statutory },
    unionDues > 0 && { name: 'Union Dues', value: Math.round(unionDues * 100) / 100, color: PIE_COLORS.union },
    otherDeductions > 0 && { name: 'Other', value: Math.round(otherDeductions * 100) / 100, color: '#94a3b8' },
  ].filter(Boolean);

  const hasPie = pieData.length >= 2;

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
      <p className="text-sm font-semibold text-foreground mb-1">Pay Breakdown</p>
      <p className="text-xs text-muted-foreground mb-4">
        Gross: <span className="font-mono font-medium text-foreground">{privacyMode ? '••••••' : formatCurrency(breakdown.gross_pay)}</span>
        {' · '}
        Net: <span className="font-mono font-medium text-primary">{privacyMode ? '••••••' : formatCurrency(netPay)}</span>
      </p>

      {!hasPie ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-6">
          <div className="w-32 h-32 rounded-full border-[10px] border-primary/20 flex items-center justify-center">
            <span className="text-2xl font-mono font-bold text-primary">100%</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-[180px]">
            Add tax settings to see your deduction breakdown.{' '}
            <Link to="/settings" className="text-primary hover:underline">Configure</Link>
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center gap-4">
          <div className="w-full" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
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

          <div className="w-full space-y-2">
            {pieData.map((entry, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-sm text-muted-foreground flex-1">{entry.name}</span>
                <span className="text-sm font-mono font-medium text-foreground">{privacyMode ? '••••••' : formatCurrency(entry.value)}</span>
                <span className="text-xs text-muted-foreground w-9 text-right">
                  {breakdown.gross_pay > 0 ? Math.round(entry.value / breakdown.gross_pay * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
