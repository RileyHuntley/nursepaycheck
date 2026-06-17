import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import ShiftCalendarGrid from '@/components/payroll/ShiftCalendarGrid';
import { calculatePeriodBreakdown, getPayPeriodForDate, getPayPeriodName } from '@/lib/premiumCalculator';

export default function ShiftCalendar() {
  const [settings, setSettings] = useState(null);
  const [shiftsMap, setShiftsMap] = useState({});
  const [loading, setLoading] = useState(true);

  const loadingRef = useRef(false);
  const loadRef = useRef(null);

  const loadShifts = useCallback(async () => {
    if (loadingRef.current) return;
    if (loadRef.current) { clearTimeout(loadRef.current); loadRef.current = null; }
    loadingRef.current = true;
    setLoading(true);
    try {
      let [settingsList, periods] = await Promise.all([
        base44.entities.Settings.list(),
        base44.entities.PayPeriod.list('-start_date', 100),
      ]);

      // Auto-create default settings for new users
      if (settingsList.length === 0) {
        const created = await base44.entities.Settings.create({
          hourly_wage: 45,
          ot_multipliers: { overtime: 1.5, overtime_extended: 2, stat_holiday: 1.5, ot_stat_holiday: 3 },
          premium_rates: { evening: 1.4, night: 5, weekend: 3.5, super_shift: 1.85, regular_premium: 2.15, short_notice: 2, responsibility_hourly: 2.5, responsibility_flat: 18.75, preceptor: 1.5, on_call_first_72: 7, on_call_beyond_72: 7.5 },
          preset_times: { day_12h_start: '07:00', day_12h_end: '19:00', night_12h_start: '19:00', night_12h_end: '07:00', day_8h_start: '08:00', day_8h_end: '16:00' },
          active_allowances: ['isolation'],
          active_qualifications: [],
          hospitals: [],
          units: [],
          default_shift_pattern: 'DDNN',
        });
        settingsList = [created];
      }
      setSettings(settingsList[0]);

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
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadShifts(); }, [loadShifts]);

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
          ...(oldBreakdown ? { breakdown: oldBreakdown } : {}),
        });
        // Add to new period
        const newDates = getPayPeriodForDate(shiftData.date);
        const newPeriod = periodList.find(p => p.start_date === newDates.start_date && p.end_date === newDates.end_date);
        if (newPeriod) {
          const newShifts = [...(newPeriod.shifts || []), { ...shiftData }];
          const newBreakdown = settings ? calculatePeriodBreakdown(newShifts, settings) : null;
          await base44.entities.PayPeriod.update(newPeriod.id, {
            shifts: newShifts,
            ...(newBreakdown ? { breakdown: newBreakdown } : {}),
          });
        } else {
          await base44.entities.PayPeriod.create({
            name: getPayPeriodName(newDates.start_date, newDates.end_date),
            start_date: newDates.start_date,
            end_date: newDates.end_date,
            shifts: [{ ...shiftData }],
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
      ...(breakdown ? { breakdown } : {}),
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