import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ShiftForm from '@/components/payroll/ShiftForm';
import ShiftRow from '@/components/payroll/ShiftRow';
import PayBreakdown from '@/components/payroll/PayBreakdown';
import { calculatePeriodBreakdown, calculateShiftPremiums, getCurrentPayPeriodDates, getPayPeriodName } from '@/lib/premiumCalculator';
import { Plus, Loader2, ChevronLeft, ChevronRight, CalendarPlus, ArrowUpDown } from 'lucide-react';
import BulkAddShift from '@/components/payroll/BulkAddShift';
import { getVCHPeriodNumber } from '@/lib/statHolidays';

export default function PayPeriodDetail() {
  const [settings, setSettings] = useState(null);
  const [period, setPeriod] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [currentPeriodIdx, setCurrentPeriodIdx] = useState(0);
  const [sortAsc, setSortAsc] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsList, periodList] = await Promise.all([
        base44.entities.Settings.list(),
        base44.entities.PayPeriod.list('-start_date', 50),
      ]);
      setSettings(settingsList[0] || null);
      setPeriods(periodList);

      // Check for period query param
      const params = new URLSearchParams(window.location.search);
      const periodId = params.get('period');

      if (periodId && periodList.length > 0) {
        const idx = periodList.findIndex(p => p.id === periodId);
        if (idx >= 0) {
          setCurrentPeriodIdx(idx);
          setPeriod(periodList[idx]);
          return;
        }
      }

      if (periodList.length > 0) {
        setPeriod(periodList[currentPeriodIdx] || periodList[0]);
      } else {
        // Create a new pay period for current bi-weekly window
        const { start_date, end_date } = getCurrentPayPeriodDates();
        const created = await base44.entities.PayPeriod.create({
          name: getPayPeriodName(start_date, end_date),
          start_date,
          end_date,
          shifts: [],
          status: 'draft',
        });
        setPeriod(created);
        setPeriods([created]);
      }
    } finally {
      setLoading(false);
    }
  }, [currentPeriodIdx]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const unsub1 = base44.entities.Settings.subscribe(() => loadData());
    const unsub2 = base44.entities.PayPeriod.subscribe(() => loadData());
    return () => { unsub1(); unsub2(); };
  }, [loadData]);

  const selectPeriod = (idx) => {
    setCurrentPeriodIdx(idx);
    setPeriod(periods[idx]);
  };

  const navigatePeriod = (direction) => {
    const newIdx = currentPeriodIdx + direction;
    if (newIdx >= 0 && newIdx < periods.length) {
      selectPeriod(newIdx);
    }
  };

  const createNewPeriod = async () => {
    setLoading(true);
    try {
      const { start_date, end_date } = getCurrentPayPeriodDates();
      const created = await base44.entities.PayPeriod.create({
        name: getPayPeriodName(start_date, end_date),
        start_date,
        end_date,
        shifts: [],
        status: 'draft',
      });
      setPeriod(created);
      setPeriods(prev => [created, ...prev]);
      setCurrentPeriodIdx(0);
    } finally {
      setLoading(false);
    }
  };

  const addShift = async (shiftData) => {
    const updatedShifts = [...(period.shifts || []), { ...shiftData }];
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
    setPeriod(updated);
    setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
    setShowForm(false);
  };

  const bulkAddShifts = async (shifts) => {
    const updatedShifts = [...(period.shifts || []), ...shifts];
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
    setPeriod(updated);
    setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
    setShowBulkForm(false);
  };

  const updateShift = async (shiftData) => {
    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === editingShift.index ? { ...shiftData } : s
    );
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
    setPeriod(updated);
    setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditingShift(null);
  };

  const deleteShift = async (shift, idx) => {
    const updatedShifts = (period.shifts || []).filter((_, i) => i !== idx);
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
    setPeriod(updated);
    setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  if (loading && !period) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!period) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Pay Period</h2>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground mb-4">No pay periods found. Create one to start logging shifts.</p>
          <Button onClick={createNewPeriod} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Create Current Pay Period
          </Button>
        </div>
      </div>
    );
  }

  const breakdown = settings && period.shifts?.length ? calculatePeriodBreakdown(period.shifts, settings) : null;

  // Sorted shifts with original indices
  const sortedShifts = (period.shifts || []).map((s, i) => ({ ...s, _origIdx: i }));
  sortedShifts.sort((a, b) => {
    const diff = (a.date || '').localeCompare(b.date || '');
    return sortAsc ? diff : -diff;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Pay Period</h2>
          {period && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              {getVCHPeriodNumber(period.start_date) && (
                <span className="text-[11px] font-mono font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  PP {getVCHPeriodNumber(period.start_date)}
                </span>
              )}
              <span>{period.name} · {period.shifts?.length || 0} shifts ·{' '}
                <span className={period.status === 'calculated' ? 'text-primary font-medium' : 'text-chart-2'}>
                  {period.status === 'calculated' ? 'Calculated' : 'Draft'}
                </span>
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {periods.length > 1 && (
            <div className="flex items-center gap-1 mr-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigatePeriod(-1)} disabled={currentPeriodIdx >= periods.length - 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-1 min-w-[60px] text-center">
                {periods.length - currentPeriodIdx} / {periods.length}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigatePeriod(1)} disabled={currentPeriodIdx <= 0}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={createNewPeriod}>
            <Plus className="w-4 h-4 mr-1.5" /> New Period
          </Button>
        </div>
      </div>

      {/* Shift Log */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Shift Log</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSortAsc(s => !s)}
              className="h-8 px-2 text-xs text-muted-foreground"
              title={sortAsc ? 'Sorted chronologically — click to reverse' : 'Sorted reverse — click for chronological'}
            >
              <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
              {sortAsc ? 'Oldest first' : 'Newest first'}
            </Button>
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
              minDate={period.start_date}
              maxDate={period.end_date}
            />
          </div>
        )}

        {showForm && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <ShiftForm
              onSubmit={addShift}
              onCancel={() => setShowForm(false)}
              settings={settings}
              minDate={period.start_date}
              maxDate={period.end_date}
            />
          </div>
        )}

        {editingShift && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <ShiftForm
              initial={editingShift.data}
              onSubmit={updateShift}
              onCancel={() => setEditingShift(null)}
              settings={settings}
              minDate={period.start_date}
              maxDate={period.end_date}
            />
          </div>
        )}

        <div className="divide-y divide-border">
          {(!period.shifts || period.shifts.length === 0) && !showForm && !showBulkForm && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">No shifts logged yet for this pay period.</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => setShowBulkForm(true)}>
                  <CalendarPlus className="w-4 h-4 mr-1.5" /> Bulk Add
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Single Shift
                </Button>
              </div>
            </div>
          )}
          {sortedShifts.map((shift) => (
            <ShiftRow
              key={shift._origIdx}
              shift={shift}
              premiums={settings ? calculateShiftPremiums(shift, settings) : null}
              settings={settings}
              onEdit={(s) => setEditingShift({ data: s, index: shift._origIdx })}
              onDelete={() => deleteShift(shift, shift._origIdx)}
            />
          ))}
        </div>

      </div>

      {/* Breakdown */}
      {(breakdown || period.breakdown) && (
        <PayBreakdown breakdown={breakdown} wage={settings?.hourly_wage} />
      )}
    </div>
  );
}