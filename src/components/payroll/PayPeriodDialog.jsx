import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import ShiftRow from '@/components/payroll/ShiftRow';
import PayBreakdown from '@/components/payroll/PayBreakdown';
import { calculateShiftPremiums } from '@/lib/premiumCalculator';
import { getVCHPeriodNumber } from '@/lib/statHolidays';

export default function PayPeriodDialog({ period, open, onClose }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !period) return;
    setLoading(true);
    base44.entities.Settings.list().then(list => {
      setSettings(list.length > 0 ? list[0] : null);
      setLoading(false);
    });
  }, [open, period]);

  if (!period) return null;

  const shifts = period.shifts || [];
  const sorted = [...shifts].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{period.name}</span>
            {getVCHPeriodNumber(period.start_date) && (
              <span className="text-[11px] font-mono font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                PP {getVCHPeriodNumber(period.start_date)}
              </span>
            )}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {period.start_date} – {period.end_date} · {shifts.length} shift{shifts.length !== 1 ? 's' : ''}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No shifts logged for this period.</p>
            ) : (
              <div className="border border-border rounded-lg divide-y divide-border">
                {sorted.map((shift, i) => (
                  <div key={i} className="bg-muted/20">
                    <ShiftRow
                      shift={shift}
                      premiums={settings ? calculateShiftPremiums(shift, settings) : null}
                      settings={settings}
                      periodEndDate={period.end_date}
                      readOnly
                    />
                  </div>
                ))}
              </div>
            )}

            {(period.breakdown || (settings && sorted.length > 0)) && (
              <PayBreakdown
                breakdown={period.breakdown}
                wage={settings?.hourly_wage}
                taxSettings={settings?.tax_settings}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}