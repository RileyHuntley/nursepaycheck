import { useMemo } from 'react';
import PaySummaryPanel from '@/components/payroll/PaySummaryPanel';
import { calculatePeriodBreakdown } from '@/lib/premiumCalculator';

export default function PayPeriodSummary({ period, shifts, settings, isFirstOfMonth, allPeriods }) {
  const breakdown = useMemo(() => {
    return calculatePeriodBreakdown(shifts, settings, isFirstOfMonth);
  }, [shifts, settings, isFirstOfMonth]);

  return (
    <PaySummaryPanel
      title={period.name || `${period.start_date} – ${period.end_date}`}
      breakdown={breakdown}
      taxSettings={settings?.tax_settings}
      shiftCount={shifts.length}
      verifiedDeductions={period.verified_deductions}
    />
  );
}