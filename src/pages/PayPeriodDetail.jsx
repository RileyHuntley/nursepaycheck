import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ShiftForm from '@/components/payroll/ShiftForm';
import ShiftRow from '@/components/payroll/ShiftRow';
import PayBreakdown from '@/components/payroll/PayBreakdown';
import { calculatePeriodBreakdown, getCurrentPayPeriodDates, getPayPeriodName } from '@/lib/premiumCalculator';
import { Plus, Loader2, Calculator, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PayPeriodDetail() {
  const [settings, setSettings] = useState(null);
  const [period, setPeriod] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [currentPeriodIdx, setCurrentPeriodIdx] = useState(0);

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
    const updated = await base44.entities.PayPeriod.update(period.id, { shifts: updatedShifts });
    setPeriod(updated);
    setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
    setShowForm(false);
  };

  const updateShift = async (shiftData) => {
    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === editingShift.index ? { ...shiftData } : s
    );
    const updated = await base44.entities.PayPeriod.update(period.id, { shifts: updatedShifts });
    setPeriod(updated);
    setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditingShift(null);
  };

  const deleteShift = async (shift, idx) => {
    const updatedShifts = (period.shifts || []).filter((_, i) => i !== idx);
    const updated = await base44.entities.PayPeriod.update(period.id, { shifts: updatedShifts });
    setPeriod(updated);
    setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const calculatePay = async () => {
    if (!settings || !period || !period.shifts?.length) return;
    setCalculating(true);
    try {
      const breakdown = calculatePeriodBreakdown(period.shifts, settings);
      const updated = await base44.entities.PayPeriod.update(period.id, {
        breakdown,
        status: 'calculated',
      });
      setPeriod(updated);
      setPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
    } finally {
      setCalculating(false);
    }
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

  const breakdown = period.breakdown || (settings && period.shifts?.length ? calculatePeriodBreakdown(period.shifts, settings) : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Pay Period</h2>
          {period && (
            <p className="text-sm text-muted-foreground mt-1">
              {period.name} · {period.shifts?.length || 0} shifts ·{' '}
              <span className={period.status === 'calculated' ? 'text-primary font-medium' : 'text-chart-2'}>
                {period.status === 'calculated' ? 'Calculated' : 'Draft'}
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
          <Button
            size="sm"
            className="bg-primary text-primary-foreground"
            onClick={() => { setShowForm(true); setEditingShift(null); }}
            disabled={showForm}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Shift
          </Button>
        </div>

        {showForm && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <ShiftForm
              onSubmit={addShift}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {editingShift && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <ShiftForm
              initial={editingShift.data}
              onSubmit={updateShift}
              onCancel={() => setEditingShift(null)}
            />
          </div>
        )}

        <div className="divide-y divide-border">
          {(!period.shifts || period.shifts.length === 0) && !showForm && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">No shifts logged yet for this pay period.</p>
              <Button
                variant="outline" size="sm" className="mt-3"
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Log Your First Shift
              </Button>
            </div>
          )}
          {period.shifts?.map((shift, idx) => (
            <ShiftRow
              key={idx}
              shift={shift}
              onEdit={(s) => setEditingShift({ data: s, index: idx })}
              onDelete={() => deleteShift(shift, idx)}
            />
          ))}
        </div>

        {/* Calculate button */}
        {period.shifts?.length > 0 && (
          <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {period.status === 'calculated'
                ? 'Breakdown calculated below. Edit shifts and recalculate if needed.'
                : `${period.shifts.length} shift${period.shifts.length > 1 ? 's' : ''} logged. Ready to calculate.`}
            </p>
            <Button onClick={calculatePay} disabled={calculating || !settings} size="sm" className="bg-primary text-primary-foreground">
              {calculating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Calculator className="w-4 h-4 mr-1.5" />}
              {period.status === 'calculated' ? 'Recalculate' : 'Calculate Pay'}
            </Button>
          </div>
        )}
      </div>

      {/* Breakdown */}
      {(breakdown || period.breakdown) && (
        <PayBreakdown breakdown={period.breakdown || breakdown} wage={settings?.hourly_wage} />
      )}
    </div>
  );
}