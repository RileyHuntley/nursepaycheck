import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import ShiftCalendarGrid from '@/components/payroll/ShiftCalendarGrid';
import { calculatePeriodBreakdown, getPayPeriodForDate, getPayPeriodName } from '@/lib/premiumCalculator';

export default function ShiftCalendar() {
  const [settings, setSettings] = useState(null);
  const [shiftsMap, setShiftsMap] = useState({});
  const [loading, setLoading] = useState(true);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsList, periods] = await Promise.all([
        base44.entities.Settings.list(),
        base44.entities.PayPeriod.list('-start_date', 100),
      ]);
      setSettings(settingsList[0] || null);
      const map = {};
      for (const p of periods) {
        for (let si = 0; si < (p.shifts || []).length; si++) {
          const s = p.shifts[si];
          if (!s.date) continue;
          if (!map[s.date]) map[s.date] = [];
          map[s.date].push({ ...s, periodId: p.id, periodName: p.name, periodShiftIdx: si });
        }
      }
      setShiftsMap(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  const loadRef = useRef(null);
  const debouncedLoad = useCallback(() => {
    if (loadRef.current) clearTimeout(loadRef.current);
    loadRef.current = setTimeout(() => loadShifts(), 300);
  }, [loadShifts]);

  useEffect(() => {
    const unsub1 = base44.entities.Settings.subscribe(() => debouncedLoad());
    const unsub2 = base44.entities.PayPeriod.subscribe(() => debouncedLoad());
    return () => { unsub1(); unsub2(); };
  }, [debouncedLoad]);

  const handleShiftUpdate = async (shiftData, editingShift) => {
    const periodList = await base44.entities.PayPeriod.list('-start_date', 100);
    const oldPeriod = periodList.find(p => p.id === editingShift.periodId);
    if (!oldPeriod) return;

    if (shiftData.date !== editingShift.data.date) {
      const stayInOld = shiftData.date >= oldPeriod.start_date && shiftData.date <= oldPeriod.end_date;
      if (!stayInOld) {
        // Remove from old period
        const oldShifts = (oldPeriod.shifts || []).filter((_, i) => i !== editingShift.periodShiftIdx);
        const oldBreakdown = settings ? calculatePeriodBreakdown(oldShifts, settings) : null;
        await base44.entities.PayPeriod.update(oldPeriod.id, {
          shifts: oldShifts,
          ...(oldBreakdown ? { breakdown: oldBreakdown, status: 'calculated' } : { status: 'draft' }),
        });
        // Add to new period
        const newDates = getPayPeriodForDate(shiftData.date);
        const newPeriod = periodList.find(p => p.start_date === newDates.start_date && p.end_date === newDates.end_date);
        if (newPeriod) {
          const newShifts = [...(newPeriod.shifts || []), { ...shiftData }];
          const newBreakdown = settings ? calculatePeriodBreakdown(newShifts, settings) : null;
          await base44.entities.PayPeriod.update(newPeriod.id, {
            shifts: newShifts,
            ...(newBreakdown ? { breakdown: newBreakdown, status: 'calculated' } : {}),
          });
        } else {
          await base44.entities.PayPeriod.create({
            name: getPayPeriodName(newDates.start_date, newDates.end_date),
            start_date: newDates.start_date,
            end_date: newDates.end_date,
            shifts: [{ ...shiftData }],
            status: 'draft',
          });
        }
        return;
      }
    }

    // Same period
    const updatedShifts = (oldPeriod.shifts || []).map((s, i) =>
      i === editingShift.periodShiftIdx ? { ...shiftData } : s
    );
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    await base44.entities.PayPeriod.update(oldPeriod.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ShiftCalendarGrid
      settings={settings}
      shiftsMap={shiftsMap}
      onShiftUpdate={handleShiftUpdate}
      onReload={loadShifts}
    />
  );
}