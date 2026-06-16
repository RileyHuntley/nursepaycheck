import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ShiftRow from '@/components/payroll/ShiftRow';
import PayBreakdown from '@/components/payroll/PayBreakdown';
import { calculatePeriodBreakdown, calculateShiftPremiums } from '@/lib/premiumCalculator';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowUpDown } from 'lucide-react';

export default function ShiftLog() {
  const [settings, setSettings] = useState(null);
  const [allShifts, setAllShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsList, periodList] = await Promise.all([
        base44.entities.Settings.list(),
        base44.entities.PayPeriod.list('-start_date', 100),
      ]);
      setSettings(settingsList[0] || null);

      // Merge all shifts from all periods with their period info
      const merged = [];
      for (const period of periodList) {
        for (const shift of (period.shifts || [])) {
          merged.push({ ...shift, _periodName: period.name, _periodId: period.id, _periodStart: period.start_date });
        }
      }
      setAllShifts(merged);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const unsub1 = base44.entities.Settings.subscribe(() => loadData());
    const unsub2 = base44.entities.PayPeriod.subscribe(() => loadData());
    return () => { unsub1(); unsub2(); };
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sorted shifts
  const sortedShifts = [...allShifts];
  sortedShifts.sort((a, b) => {
    const diff = (a.date || '').localeCompare(b.date || '');
    return sortAsc ? diff : -diff;
  });

  // YTD breakdown using all shifts (just the shift objects)
  const shiftsForBreakdown = allShifts.map(({ _periodName, _periodId, _periodStart, ...shift }) => shift);
  const breakdown = settings && shiftsForBreakdown.length ? calculatePeriodBreakdown(shiftsForBreakdown, settings) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Shift Log</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {allShifts.length} shifts across all pay periods — Year-to-Date
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSortAsc(s => !s)} className="h-8 px-2 text-xs text-muted-foreground">
          <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
          {sortAsc ? 'Oldest first' : 'Newest first'}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">All Shifts</h3>
        </div>

        <div className="divide-y divide-border">
          {allShifts.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">No shifts logged yet.</p>
            </div>
          )}
          {sortedShifts.map((shift, idx) => (
            <div key={`${shift._periodId}-${idx}`} className="px-4 py-2 bg-muted/30 border-b border-border">
              <div className="text-[10px] text-muted-foreground font-mono mb-0.5">
                {shift._periodName}
              </div>
              <ShiftRow
                shift={shift}
                premiums={settings ? calculateShiftPremiums(shift, settings) : null}
                settings={settings}
                onEdit={() => {}}
                onDelete={() => {}}
                readOnly
              />
            </div>
          ))}
        </div>
      </div>

      {breakdown && (
        <PayBreakdown breakdown={breakdown} wage={settings?.hourly_wage} />
      )}
    </div>
  );
}