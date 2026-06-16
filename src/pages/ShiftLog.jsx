import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ShiftRow from '@/components/payroll/ShiftRow';
import ShiftForm from '@/components/payroll/ShiftForm';
import PayBreakdown from '@/components/payroll/PayBreakdown';
import { calculatePeriodBreakdown, calculateShiftPremiums, getCurrentPayPeriodDates, getPayPeriodName } from '@/lib/premiumCalculator';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowUpDown, Plus, CalendarPlus } from 'lucide-react';
import BulkAddShift from '@/components/payroll/BulkAddShift';

export default function ShiftLog() {
  const [settings, setSettings] = useState(null);
  const [allShifts, setAllShifts] = useState([]);
  const [periodMap, setPeriodMap] = useState({}); // id -> period
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(true);
  const [editingShift, setEditingShift] = useState(null); // { data, _periodId, _shiftIdx }
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsList, periodList] = await Promise.all([
        base44.entities.Settings.list(),
        base44.entities.PayPeriod.list('-start_date', 100),
      ]);
      setSettings(settingsList[0] || null);

      const map = {};
      const merged = [];
      for (const period of periodList) {
        map[period.id] = period;
        const shifts = (period.shifts || []);
        for (let i = 0; i < shifts.length; i++) {
          merged.push({ ...shifts[i], _periodName: period.name, _periodId: period.id, _periodStart: period.start_date, _shiftIdx: i });
        }
      }
      setPeriodMap(map);
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

  const updateShift = async (shiftData) => {
    const period = periodMap[editingShift._periodId];
    if (!period) return;
    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === editingShift._shiftIdx ? { ...shiftData } : s
    );
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
    setEditingShift(null);
    loadData();
  };

  const deleteShift = async (shift) => {
    const period = periodMap[shift._periodId];
    if (!period) return;
    const updatedShifts = (period.shifts || []).filter((_, i) => i !== shift._shiftIdx);
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
    loadData();
  };

  const getOrCreateCurrentPeriod = async () => {
    const { start_date, end_date } = getCurrentPayPeriodDates();
    const existing = Object.values(periodMap).find(p => p.start_date === start_date && p.end_date === end_date);
    if (existing) return existing;
    const created = await base44.entities.PayPeriod.create({
      name: getPayPeriodName(start_date, end_date),
      start_date,
      end_date,
      shifts: [],
      status: 'draft',
    });
    setPeriodMap(prev => ({ ...prev, [created.id]: created }));
    return created;
  };

  const addShift = async (shiftData) => {
    const period = await getOrCreateCurrentPeriod();
    const updatedShifts = [...(period.shifts || []), { ...shiftData }];
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
    setShowForm(false);
    loadData();
  };

  const bulkAddShifts = async (shifts) => {
    const period = await getOrCreateCurrentPeriod();
    const updatedShifts = [...(period.shifts || []), ...shifts];
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
    setShowBulkForm(false);
    loadData();
  };

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

  // YTD breakdown
  const shiftsForBreakdown = allShifts.map(({ _periodName, _periodId, _periodStart, _shiftIdx, ...shift }) => shift);
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

      {editingShift && (
        <div className="bg-card border border-border rounded-xl p-5">
          <ShiftForm
            initial={editingShift.data}
            onSubmit={updateShift}
            onCancel={() => setEditingShift(null)}
            settings={settings}
          />
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">All Shifts</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setShowBulkForm(true); setShowForm(false); setEditingShift(null); }}
              disabled={showBulkForm}
            >
              <CalendarPlus className="w-4 h-4 mr-1.5" /> Bulk Add
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground"
              onClick={() => { setShowForm(true); setShowBulkForm(false); setEditingShift(null); }}
              disabled={showForm}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Shift
            </Button>
          </div>
        </div>

        {showBulkForm && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <BulkAddShift
              onSubmit={bulkAddShifts}
              onCancel={() => setShowBulkForm(false)}
              settings={settings}
            />
          </div>
        )}

        {showForm && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <ShiftForm
              onSubmit={addShift}
              onCancel={() => setShowForm(false)}
              settings={settings}
            />
          </div>
        )}

        <div className="divide-y divide-border">
          {allShifts.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">No shifts logged yet.</p>
            </div>
          )}
          {sortedShifts.map((shift, idx) => (
            <div key={`${shift._periodId}-${shift._shiftIdx}`} className="bg-muted/30 border-b border-border">
              <div className="text-[10px] text-muted-foreground font-mono px-4 pt-2">
                {shift._periodName}
              </div>
              <ShiftRow
                shift={shift}
                premiums={settings ? calculateShiftPremiums(shift, settings) : null}
                settings={settings}
                onEdit={(s) => setEditingShift({ data: s, _periodId: shift._periodId, _shiftIdx: shift._shiftIdx })}
                onDelete={() => deleteShift(shift)}
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