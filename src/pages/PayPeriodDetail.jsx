import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ShiftForm from '@/components/payroll/ShiftForm';
import ShiftRow from '@/components/payroll/ShiftRow';
import PayBreakdown from '@/components/payroll/PayBreakdown';
import { calculatePeriodBreakdown, calculateShiftPremiums, getCurrentPayPeriodDates, getPayPeriodName, getPayPeriodForDate } from '@/lib/premiumCalculator';
import { Plus, Loader2, CalendarPlus, ArrowUpDown } from 'lucide-react';
import BulkAddShift from '@/components/payroll/BulkAddShift';
import { getVCHPeriodNumber } from '@/lib/statHolidays';

export default function PayPeriodDetail() {
  const [settings, setSettings] = useState(null);
  const [period, setPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsList, periodList] = await Promise.all([
        base44.entities.Settings.list(),
        base44.entities.PayPeriod.list('-start_date', 50),
      ]);
      setSettings(settingsList[0] || null);

      // Find the current pay period
      const { start_date, end_date } = getCurrentPayPeriodDates();
      const current = periodList.find(p => p.start_date === start_date && p.end_date === end_date);

      if (current) {
        setPeriod(current);
      } else {
        // Create it
        const created = await base44.entities.PayPeriod.create({
          name: getPayPeriodName(start_date, end_date),
          start_date,
          end_date,
          shifts: [],
          status: 'draft',
        });
        setPeriod(created);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Debounced subscription reload to prevent rate limiting
  const loadRef = useRef(null);
  const debouncedLoad = useCallback(() => {
    if (loadRef.current) clearTimeout(loadRef.current);
    loadRef.current = setTimeout(() => loadData(), 300);
  }, [loadData]);

  useEffect(() => {
    const unsub1 = base44.entities.Settings.subscribe(() => debouncedLoad());
    const unsub2 = base44.entities.PayPeriod.subscribe(() => debouncedLoad());
    return () => { unsub1(); unsub2(); };
  }, [debouncedLoad]);

  const isValidForPeriod = (date) => {
    if (!period) return false;
    return date >= period.start_date && date <= period.end_date;
  };

  const addShift = async (shiftData) => {
    if (!isValidForPeriod(shiftData.date)) {
      // Allow but warn: if date is outside current period, auto-route to correct period
      const { start_date, end_date } = getPayPeriodForDate(shiftData.date);
      const allPeriods = await base44.entities.PayPeriod.list('-start_date', 50);
      const existing = allPeriods.find(p => p.start_date === start_date && p.end_date === end_date);
      if (existing) {
        const updatedShifts = [...(existing.shifts || []), { ...shiftData }];
        const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
        await base44.entities.PayPeriod.update(existing.id, {
          shifts: updatedShifts,
          ...(breakdown ? { breakdown, status: 'calculated' } : {}),
        });
      } else {
        await base44.entities.PayPeriod.create({
          name: getPayPeriodName(start_date, end_date),
          start_date,
          end_date,
          shifts: [{ ...shiftData }],
          status: 'draft',
        });
      }
      // Reload to refresh the current period view
      loadData();
      setShowForm(false);
      return;
    }

    const updatedShifts = [...(period.shifts || []), { ...shiftData }];
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
    setPeriod(updated);
    setShowForm(false);
  };

  const bulkAddShifts = async (shifts) => {
    // Route each shift to its correct period
    const allPeriods = await base44.entities.PayPeriod.list('-start_date', 50);
    const groups = {};
    for (const s of shifts) {
      const { start_date, end_date } = getPayPeriodForDate(s.date);
      const key = `${start_date}|${end_date}`;
      if (!groups[key]) {
        const existing = allPeriods.find(p => p.start_date === start_date && p.end_date === end_date);
        if (existing) {
          groups[key] = { period: existing, created: false };
        } else {
          const created = await base44.entities.PayPeriod.create({
            name: getPayPeriodName(start_date, end_date),
            start_date,
            end_date,
            shifts: [],
            status: 'draft',
          });
          groups[key] = { period: created, created: true };
          allPeriods.push(created);
        }
      }
      if (!groups[key].shifts) groups[key].shifts = [];
      groups[key].shifts.push({ ...s });
    }
    for (const { period, shifts: groupShifts } of Object.values(groups)) {
      const updatedShifts = [...(period.shifts || []), ...groupShifts];
      const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
      await base44.entities.PayPeriod.update(period.id, {
        shifts: updatedShifts,
        ...(breakdown ? { breakdown, status: 'calculated' } : {}),
      });
    }
    loadData();
    setShowBulkForm(false);
  };

  const updateShift = async (shiftData) => {
    // If date changed and no longer in this period, route to correct period
    if (!isValidForPeriod(shiftData.date)) {
      const { start_date, end_date } = getPayPeriodForDate(shiftData.date);
      const allPeriods = await base44.entities.PayPeriod.list('-start_date', 50);

      // Remove from this period
      const updatedShifts = (period.shifts || []).filter((_, i) => i !== editingShift.index);
      const thisBreakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
      await base44.entities.PayPeriod.update(period.id, {
        shifts: updatedShifts,
        ...(thisBreakdown ? { breakdown: thisBreakdown, status: 'calculated' } : { status: 'draft' }),
      });

      // Add to correct period
      const target = allPeriods.find(p => p.start_date === start_date && p.end_date === end_date);
      if (target) {
        const targetShifts = [...(target.shifts || []), { ...shiftData }];
        const targetBreakdown = settings ? calculatePeriodBreakdown(targetShifts, settings) : null;
        await base44.entities.PayPeriod.update(target.id, {
          shifts: targetShifts,
          ...(targetBreakdown ? { breakdown: targetBreakdown, status: 'calculated' } : {}),
        });
      } else {
        await base44.entities.PayPeriod.create({
          name: getPayPeriodName(start_date, end_date),
          start_date,
          end_date,
          shifts: [{ ...shiftData }],
          status: 'draft',
        });
      }
      loadData();
      setEditingShift(null);
      return;
    }

    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === editingShift.index ? { ...shiftData } : s
    );
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
    setPeriod(updated);
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
        <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Current Pay Period</h2>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">Unable to determine current pay period.</p>
        </div>
      </div>
    );
  }

  // Filter shifts to only those within this period's date range
  const allWithIdx = (period.shifts || []).map((s, i) => ({ ...s, _origIdx: i }));
  const displayShifts = allWithIdx.filter(s => isValidForPeriod(s.date));
  const breakdown = settings && displayShifts.length ? calculatePeriodBreakdown(displayShifts, settings) : null;

  // Sorted for display
  const sortedShifts = [...displayShifts];
  sortedShifts.sort((a, b) => {
    const diff = (a.date || '').localeCompare(b.date || '');
    return sortAsc ? diff : -diff;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Current Pay Period</h2>
          {period && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              {getVCHPeriodNumber(period.start_date) && (
                <span className="text-[11px] font-mono font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  PP {getVCHPeriodNumber(period.start_date)}
                </span>
              )}
              <span>{period.name} · {displayShifts.length} shift{displayShifts.length !== 1 ? 's' : ''}</span>
            </p>
          )}
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

        {editingShift && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <ShiftForm
              initial={editingShift.data}
              onSubmit={updateShift}
              onCancel={() => setEditingShift(null)}
              settings={settings}
            />
          </div>
        )}

        <div className="divide-y divide-border">
          {displayShifts.length === 0 && !showForm && !showBulkForm && (
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