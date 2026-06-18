import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import ShiftForm from '@/components/payroll/ShiftForm';
import BulkAddShift from '@/components/payroll/BulkAddShift';
import ShiftCalendarGrid from '@/components/payroll/ShiftCalendarGrid';
import ShiftRow from '@/components/payroll/ShiftRow';
import { calculateShiftPremiums } from '@/lib/premiumCalculator';
import { useToast } from '@/components/ui/use-toast';
import { getPayPeriodForDate, getCurrentPayPeriodDates, calculatePeriodBreakdown, getPayPeriodName, getFirstPeriodsOfMonths, isDuplicateShift } from '@/lib/premiumCalculator';
import { getVCHPayPeriod, getVCHPeriodNumber, getVCHPayDate } from '@/lib/statHolidays';
import PayPeriodSummary from '@/components/payroll/PayPeriodSummary';

function getDefaultStatus(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d < new Date() ? 'completed' : 'scheduled';
}

export default function PayPeriodDetail() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [period, setPeriod] = useState(null);
  const [allPeriods, setAllPeriods] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

  const loadingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const [settingsList, allList] = await Promise.all([
      base44.entities.Settings.list(),
      base44.entities.PayPeriod.list('-start_date', 50),
    ]);

    let fetched;
    if (paramId) {
      fetched = allList.find(p => p.id === paramId) || await base44.entities.PayPeriod.get(paramId);
    } else {
      const { start_date, end_date } = getCurrentPayPeriodDates();
      fetched = allList.find(p => p.start_date === start_date && p.end_date === end_date);
      if (!fetched) {
        fetched = await base44.entities.PayPeriod.create({
          name: getPayPeriodName(start_date, end_date),
          start_date,
          end_date,
          shifts: [],
        });
        allList.push(fetched);
      }
    }
    const userSettings = settingsList[0]
      ? {
          hourly_wage: 45,
          ot_multipliers: { overtime: 1.5, overtime_extended: 2, stat_holiday: 1.5, ot_stat_holiday: 3 },
          premium_rates: { evening: 1.4, night: 5, weekend: 3.5, super_shift: 1.85, regular_premium: 2.15, specialty: 2, short_notice: 2, responsibility_hourly: 2.5, responsibility_flat: 18.75, preceptor: 1.5, on_call_first_72: 7, on_call_beyond_72: 7.5 },
          preset_times: { day_12h_start: '07:00', day_12h_end: '19:00', night_12h_start: '19:00', night_12h_end: '07:00', day_8h_start: '08:00', day_8h_end: '16:00' },
          active_allowances: ['isolation'],
          active_qualifications: [],
          hospitals: [],
          units: [],
          default_shift_pattern: 'DDNN',
          shift_lines: [{ status: 'full_time', fte: 1.0, hospital: '', unit: '' }],
          tax_settings: { annual_provincial_income: 0, annual_federal_income: 0 },
          ...settingsList[0],
        }
      : null;
    setPeriod(fetched);
    setAllPeriods(allList);
    setSettings(userSettings);
    loadingRef.current = false;
    setLoading(false);
  }, [paramId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const unsub = base44.entities.PayPeriod.subscribe(() => loadData());
    return () => unsub();
  }, [loadData]);

  const isValidForPeriod = (dateStr) =>
    period && dateStr >= period.start_date && dateStr <= period.end_date;

  const isFirstOfMonth = period ? getFirstPeriodsOfMonths(allPeriods).has(period.start_date) : false;

  const isFirstForPeriod = (startDate) => getFirstPeriodsOfMonths(allPeriods).has(startDate);

  const addShift = async (shiftData) => {
    shiftData.status = shiftData.status || getDefaultStatus(shiftData.date);

    if (shiftData.date < '2025-01-01') {
      toast({ title: 'Date out of range', description: 'Shifts cannot be added before January 1, 2025.', variant: 'destructive' });
      return;
    }

    // Check for duplicate: same date + same start_time + same end_time
    if (isValidForPeriod(shiftData.date) && isDuplicateShift(period.shifts || [], shiftData)) {
      toast({ title: 'Duplicate shift', description: 'A shift with the same date, start, and end time already exists.', variant: 'destructive' });
      return;
    }

    if (!isValidForPeriod(shiftData.date)) {
      // Allow but warn: if date is outside current period, auto-route to correct period
      const { start_date, end_date } = getPayPeriodForDate(shiftData.date);
      const allPeriods = await base44.entities.PayPeriod.list('-start_date', 50);
      const existing = allPeriods.find(p => p.start_date === start_date && p.end_date === end_date);
      if (existing) {
        if (isDuplicateShift(existing.shifts || [], shiftData)) {
          toast({ title: 'Duplicate shift', description: 'A shift with the same date, start, and end time already exists.', variant: 'destructive' });
          setShowForm(false);
          return;
        }
        const updatedShifts = [...(existing.shifts || []), { ...shiftData }];
        const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, getFirstPeriodsOfMonths(allPeriods).has(start_date)) : null;
        await base44.entities.PayPeriod.update(existing.id, {
          shifts: updatedShifts,
          ...(breakdown ? { breakdown } : {}),
        });
      } else {
        await base44.entities.PayPeriod.create({
          name: getPayPeriodName(start_date, end_date),
          start_date,
          end_date,
          shifts: [{ ...shiftData }],
          
        });
      }
      // Reload to refresh the current period view
      loadData();
      setShowForm(false);
      return;
    }

    const updatedShifts = [...(period.shifts || []), { ...shiftData }];
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, isFirstOfMonth) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown } : {}),
    });
    setPeriod(updated);
    setShowForm(false);
  };

  const bulkAddShifts = async (shifts) => {
    const tooOld = shifts.filter(s => s.date < '2025-01-01');
    if (tooOld.length > 0) {
      toast({ title: 'Date out of range', description: `${tooOld.length} shift(s) are before January 1, 2025 and were skipped.`, variant: 'destructive' });
      shifts = shifts.filter(s => s.date >= '2025-01-01');
      if (shifts.length === 0) return;
    }
    try {
      const res = await base44.functions.invoke('bulkAddShifts', { shifts, settings });
      const result = res.data;
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        const msg = `${result.added} shift(s) added across ${result.periods} pay period(s)`;
        const desc = result.skipped > 0 ? `${result.skipped} duplicate(s) skipped` : undefined;
        toast({ title: msg, description: desc });
      }
    } catch (e) {
      toast({ title: 'Error adding shifts', description: e.message || 'Something went wrong', variant: 'destructive' });
    }
    loadData();
    setShowBulk(false);
  };

  const updateShift = async (index, shiftData) => {
    const updatedShifts = [...(period.shifts || [])];
    updatedShifts[index] = { ...updatedShifts[index], ...shiftData };
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, isFirstOfMonth) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown } : {}),
    });
    setPeriod(updated);
    setEditingShift(null);
    setEditingIndex(null);
  };

  const deleteShift = async (index) => {
    const updatedShifts = (period.shifts || []).filter((_, i) => i !== index);
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, isFirstOfMonth) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown } : {}),
    });
    setPeriod(updated);
  };

  const navigatePeriod = async (direction) => {
    const sorted = [...allPeriods].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const idx = sorted.findIndex(p => p.id === period.id);
    const next = sorted[idx + direction];
    if (next) navigate(`/pay-period/${next.id}`);
  };

  if (loading || !period) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const shifts = period.shifts || [];
  const vcpPeriod = getVCHPayPeriod(period.start_date);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigatePeriod(-1)}
            disabled={allPeriods.findIndex(p => p.id === period.id) === [...allPeriods].sort((a,b) => a.start_date.localeCompare(b.start_date)).findIndex(p => p.id === period.id) && [...allPeriods].sort((a,b) => a.start_date.localeCompare(b.start_date)).findIndex(p => p.id === period.id) === 0}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground tracking-tight">
              {getPayPeriodName(period.start_date, period.end_date)}
            </h2>
            {vcpPeriod && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                {getVCHPeriodNumber(period.start_date) && (
                  <span className="text-[11px] font-mono font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                    PP {getVCHPeriodNumber(period.start_date)}
                  </span>
                )}
                {getVCHPayDate(period.start_date) && (
                  <span>Paid {new Date(getVCHPayDate(period.start_date) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                )}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigatePeriod(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowBulk(b => !b); setShowForm(false); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Bulk Add
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setShowForm(f => !f); setShowBulk(false); setEditingShift(null); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Shift
          </Button>
        </div>
      </div>

      {/* Bulk Add form */}
      {showBulk && (
        <BulkAddShift
          onSubmit={bulkAddShifts}
          onCancel={() => setShowBulk(false)}
          periodStart={period.start_date}
          periodEnd={period.end_date}
          settings={settings}
        />
      )}

      {/* Add/Edit Shift Form */}
      {(showForm || editingShift) && (
        <ShiftForm
          shift={editingShift}
          defaultDate={period.start_date}
          settings={settings}
          onSubmit={editingShift ? (data) => updateShift(editingIndex, data) : addShift}
          onCancel={() => { setShowForm(false); setEditingShift(null); setEditingIndex(null); }}
        />
      )}

      {/* Calendar Grid */}
      <ShiftCalendarGrid
        periodStart={period.start_date}
        periodEnd={period.end_date}
        shiftsMap={shifts.reduce((map, s, i) => {
          if (!s.date) return map;
          if (!map[s.date]) map[s.date] = [];
          map[s.date].push({ ...s, periodId: period.id, periodShiftIdx: i });
          return map;
        }, {})}
        settings={settings}
        showHeader={false}
        onShiftUpdate={async (shiftData, editInfo) => {
          await updateShift(editInfo.periodShiftIdx, shiftData);
        }}
        onReload={loadData}
      />

      {/* Shift Log */}
      {shifts.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-display font-semibold text-foreground">
              Shift Log <span className="text-muted-foreground font-normal">({shifts.length} shift{shifts.length !== 1 ? 's' : ''})</span>
            </h3>
          </div>
          <div className="divide-y divide-border">
            {[...shifts]
              .map((s, i) => ({ shift: s, origIndex: i }))
              .sort((a, b) => (a.shift.date || '').localeCompare(b.shift.date || '') || (a.shift.start_time || '').localeCompare(b.shift.start_time || ''))
              .map(({ shift, origIndex }) => (
                <ShiftRow
                  key={origIndex}
                  shift={shift}
                  premiums={settings ? calculateShiftPremiums(shift, settings) : null}
                  settings={settings}
                  periodEndDate={period.end_date}
                  onEdit={() => { setEditingShift(shift); setEditingIndex(origIndex); setShowForm(false); }}
                  onDelete={() => deleteShift(origIndex)}
                  onVerify={() => updateShift(origIndex, { ...shift, status: 'verified' })}
                  onDuplicate={() => addShift({ ...shift, status: 'pending' })}
                />
              ))}
          </div>
        </div>
      )}

      {/* Pay Summary */}
      {shifts.length > 0 && settings && (
        <PayPeriodSummary
          period={period}
          shifts={shifts}
          settings={settings}
          isFirstOfMonth={isFirstOfMonth}
          allPeriods={allPeriods}
        />
      )}
    </div>
  );
}