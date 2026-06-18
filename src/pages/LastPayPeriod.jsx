import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ShiftForm from '@/components/payroll/ShiftForm';
import ShiftRow from '@/components/payroll/ShiftRow';
import PayBreakdown from '@/components/payroll/PayBreakdown';
import { calculatePeriodBreakdown, calculateShiftPremiums, getPayPeriodForDate, getPayPeriodName, isDuplicateShift, getFirstPeriodsOfMonths } from '@/lib/premiumCalculator';
import { toast } from '@/components/ui/use-toast';
import { Plus, Loader2, CalendarPlus, ArrowUpDown, ClipboardList, FileDown } from 'lucide-react';
import BulkAddShift from '@/components/payroll/BulkAddShift';
import { getVCHPeriodNumber } from '@/lib/statHolidays';

export default function LastPayPeriod() {
  const [settings, setSettings] = useState(null);
  const [period, setPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allPeriods, setAllPeriods] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Verified deductions form state
  const [deductionsDirty, setDeductionsDirty] = useState(false);
  const [savingDeductions, setSavingDeductions] = useState(false);
  const [deductionsForm, setDeductionsForm] = useState(null); // local copy when editing

  const todayStr = new Date().toISOString().slice(0, 10);

  const loadingRef = useRef(false);
  const loadRef = useRef(null);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    if (loadRef.current) { clearTimeout(loadRef.current); loadRef.current = null; }
    loadingRef.current = true;
    setLoading(true);
    try {
      const settingsList = await base44.entities.Settings.list();

      // Auto-create default settings for new users
      if (settingsList.length === 0) {
        const created = await base44.entities.Settings.create({
          hourly_wage: 45,
          ot_multipliers: { overtime: 1.5, overtime_extended: 2, stat_holiday: 1.5, ot_stat_holiday: 3 },
          premium_rates: { evening: 1.4, night: 5, weekend: 3.5, super_shift: 1.85, regular_premium: 2.15, specialty: 2, short_notice: 2, responsibility_hourly: 2.5, responsibility_flat: 18.75, preceptor: 1.5, on_call_first_72: 7, on_call_beyond_72: 7.5 },
          preset_times: { day_12h_start: '07:00', day_12h_end: '19:00', night_12h_start: '19:00', night_12h_end: '07:00', day_8h_start: '08:00', day_8h_end: '16:00' },
          active_allowances: ['isolation'],
          active_qualifications: [],
          hospitals: [],
          units: [],
          default_shift_pattern: 'DDNN',
        });
        settingsList = [created];
      }
      // Merge with defaults in case settings were created by a page that didn't include all fields
      const loadedSettings = {
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
      };
      setSettings(loadedSettings);

      // Find the last (most recently completed) pay period
      const periodList = await base44.entities.PayPeriod.list('-start_date', 50);
      setAllPeriods(periodList);
      const pastPeriods = periodList
        .filter(p => p.end_date < todayStr)
        .sort((a, b) => b.end_date.localeCompare(a.end_date));

      if (pastPeriods.length > 0) {
        const last = pastPeriods[0];
        setPeriod(last);
        // Initialize deductions form from saved data
        const vd = last.verified_deductions || {};
        setDeductionsForm({
          cpp: vd.cpp ?? '',
          cpp2: vd.cpp2 ?? '',
          ei: vd.ei ?? '',
          federal_tax: vd.federal_tax ?? '',
          provincial_tax: vd.provincial_tax ?? '',
          union_dues: vd.union_dues ?? '',
          other_deductions: vd.other_deductions ?? '',
          other_label: vd.other_label ?? '',
          notes: vd.notes ?? '',
        });
      } else {
        setPeriod(null);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => { loadData(); }, [loadData]);

  const debouncedLoad = useCallback(() => {
    if (loadRef.current) clearTimeout(loadRef.current);
    loadRef.current = setTimeout(() => loadData(), 500);
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

  const getDefaultStatus = (date) => date > todayStr ? 'upcoming' : 'pending';

  const isFirstForPeriod = (startDate) => getFirstPeriodsOfMonths(allPeriods).has(startDate);

  const addShift = async (shiftData) => {
    shiftData.status = shiftData.status || getDefaultStatus(shiftData.date);

    if (isValidForPeriod(shiftData.date) && isDuplicateShift(period.shifts || [], shiftData)) {
      toast({ title: 'Duplicate shift', description: 'A shift with the same date, start, and end time already exists.', variant: 'destructive' });
      return;
    }

    if (!isValidForPeriod(shiftData.date)) {
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
        await base44.entities.PayPeriod.update(existing.id, { shifts: updatedShifts, ...(breakdown ? { breakdown } : {}) });
      } else {
        await base44.entities.PayPeriod.create({ name: getPayPeriodName(start_date, end_date), start_date, end_date, shifts: [{ ...shiftData }] });
      }
      loadData();
      setShowForm(false);
      return;
    }

    const updatedShifts = [...(period.shifts || []), { ...shiftData }];
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, isFirstOfMonth) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, { shifts: updatedShifts, ...(breakdown ? { breakdown } : {}) });
    setPeriod(updated);
    setShowForm(false);
  };

  const bulkAddShifts = async (shifts) => {
    const allPeriods = await base44.entities.PayPeriod.list('-start_date', 50);
    const groups = {};
    for (const s of shifts) {
      const { start_date, end_date } = getPayPeriodForDate(s.date);
      const key = `${start_date}|${end_date}`;
      if (!groups[key]) {
        const existing = allPeriods.find(p => p.start_date === start_date && p.end_date === end_date);
        if (existing) {
          groups[key] = { period: existing };
        } else {
          const created = await base44.entities.PayPeriod.create({ name: getPayPeriodName(start_date, end_date), start_date, end_date, shifts: [] });
          groups[key] = { period: created };
          allPeriods.push(created);
        }
      }
      if (!groups[key].shifts) groups[key].shifts = [];
      groups[key].shifts.push({ ...s, status: s.status || getDefaultStatus(s.date) });
    }
    let skippedCount = 0;
    for (const { period: p, shifts: groupShifts } of Object.values(groups)) {
      const existing = p.shifts || [];
      const filtered = groupShifts.filter(s => !isDuplicateShift(existing, s));
      skippedCount += groupShifts.length - filtered.length;
      const updatedShifts = [...existing, ...filtered];
      const isFirst = getFirstPeriodsOfMonths(allPeriods).has(p.start_date);
      const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, isFirst) : null;
      await base44.entities.PayPeriod.update(p.id, { shifts: updatedShifts, ...(breakdown ? { breakdown } : {}) });
      }
      if (skippedCount > 0) {
      toast({ title: 'Duplicates skipped', description: `${skippedCount} shift${skippedCount !== 1 ? 's' : ''} skipped — same date, start, and end time already exists.` });
    }
    loadData();
    setShowBulkForm(false);
  };

  const updateShift = async (shiftData) => {
    if (!isValidForPeriod(shiftData.date)) {
      const { start_date, end_date } = getPayPeriodForDate(shiftData.date);
      const allPeriods = await base44.entities.PayPeriod.list('-start_date', 50);
      const updatedShifts = (period.shifts || []).filter((_, i) => i !== editingShift.index);
      const thisBreakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, isFirstOfMonth) : null;
      await base44.entities.PayPeriod.update(period.id, { shifts: updatedShifts, ...(thisBreakdown ? { breakdown: thisBreakdown } : {}) });
      const target = allPeriods.find(p => p.start_date === start_date && p.end_date === end_date);
      if (target) {
       const targetShifts = [...(target.shifts || []), { ...shiftData }];
       const isTargetFirst = getFirstPeriodsOfMonths(allPeriods).has(start_date);
       const targetBreakdown = settings ? calculatePeriodBreakdown(targetShifts, settings, isTargetFirst) : null;
       await base44.entities.PayPeriod.update(target.id, { shifts: targetShifts, ...(targetBreakdown ? { breakdown: targetBreakdown } : {}) });
      } else {
        await base44.entities.PayPeriod.create({ name: getPayPeriodName(start_date, end_date), start_date, end_date, shifts: [{ ...shiftData }] });
      }
      loadData();
      setEditingShift(null);
      return;
    }
    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === editingShift.index ? { ...shiftData } : s
    );
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, isFirstOfMonth) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, { shifts: updatedShifts, ...(breakdown ? { breakdown } : {}) });
    setPeriod(updated);
    setEditingShift(null);
  };

  const deleteShift = async (shift, idx) => {
    const updatedShifts = (period.shifts || []).filter((_, i) => i !== idx);
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, isFirstOfMonth) : null;
    const updated = await base44.entities.PayPeriod.update(period.id, { shifts: updatedShifts, ...(breakdown ? { breakdown } : {}) });
    setPeriod(updated);
  };

  const verifyShift = async (shift, idx) => {
    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === idx ? { ...s, status: 'verified' } : s
    );
    const updated = await base44.entities.PayPeriod.update(period.id, { shifts: updatedShifts });
    setPeriod(updated);
  };

  // ── Deductions form handlers ──
  const setDeductionField = (field, value) => {
    const str = value === '' ? '' : parseFloat(value) || value;
    setDeductionsForm(prev => ({ ...prev, [field]: str }));
    setDeductionsDirty(true);
  };

  const setDeductionText = (field, value) => {
    setDeductionsForm(prev => ({ ...prev, [field]: value }));
    setDeductionsDirty(true);
  };

  const saveDeductions = async () => {
    if (!period || !deductionsForm) return;
    setSavingDeductions(true);
    try {
      const data = {};
      ['cpp', 'cpp2', 'ei', 'federal_tax', 'provincial_tax', 'union_dues', 'other_deductions'].forEach(k => {
        const val = deductionsForm[k];
        if (val !== '' && val != null) data[k] = parseFloat(val) || 0;
      });
      if (deductionsForm.other_label) data.other_label = deductionsForm.other_label;
      if (deductionsForm.notes) data.notes = deductionsForm.notes;

      const updated = await base44.entities.PayPeriod.update(period.id, { verified_deductions: data });
      setPeriod(updated);
      setDeductionsDirty(false);
      toast({ title: 'Saved', description: 'Verified deductions saved for this pay period.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSavingDeductions(false);
    }
  };

  const exportPDF = async () => {
    if (!period) return;
    try {
      const res = await base44.functions.invoke('exportPayPeriodPDF', { periodId: period.id });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pay-period-${period.start_date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: 'Export failed', description: 'Could not generate PDF. Please try again.', variant: 'destructive' });
    }
  };

  const clearDeductions = async () => {
    if (!period) return;
    setSavingDeductions(true);
    try {
      const updated = await base44.entities.PayPeriod.update(period.id, { verified_deductions: null });
      setPeriod(updated);
      setDeductionsForm({ cpp: '', cpp2: '', ei: '', federal_tax: '', provincial_tax: '', union_dues: '', other_deductions: '', other_label: '', notes: '' });
      setDeductionsDirty(false);
      toast({ title: 'Cleared', description: 'Verified deductions removed — estimates will be used instead.' });
    } catch (e) {
      toast({ title: 'Clear failed', description: e.message, variant: 'destructive' });
    } finally {
      setSavingDeductions(false);
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
        <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Last Pay Period</h2>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">No completed pay periods found.</p>
        </div>
      </div>
    );
  }

  // Determine if this period is the first of its month with shifts
  const firstPeriodsSet = getFirstPeriodsOfMonths(allPeriods);
  const isFirstOfMonth = period && firstPeriodsSet.has(period.start_date);

  // Filter shifts to only those within this period's date range
  const allWithIdx = (period.shifts || []).map((s, i) => ({ ...s, _origIdx: i }));
  const displayShifts = allWithIdx.filter(s => isValidForPeriod(s.date));
  const breakdown = settings && displayShifts.length ? calculatePeriodBreakdown(displayShifts, settings, isFirstOfMonth) : null;

  const sortedShifts = [...displayShifts];
  sortedShifts.sort((a, b) => {
    const diff = (a.date || '').localeCompare(b.date || '');
    return sortAsc ? diff : -diff;
  });

  const hasVerifiedDeductions = period.verified_deductions && Object.keys(period.verified_deductions).some(k => ['cpp', 'cpp2', 'ei', 'federal_tax', 'provincial_tax'].includes(k) && period.verified_deductions[k] > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Last Pay Period</h2>
          {period && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              {getVCHPeriodNumber(period.start_date) && (
                <span className="text-[11px] font-mono font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  PP {getVCHPeriodNumber(period.start_date)}
                </span>
              )}
              <span>{period.name} · {displayShifts.length} shift{displayShifts.length !== 1 ? 's' : ''}</span>
              <span className="text-xs text-muted-foreground/70">(completed {new Date(period.end_date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })})</span>
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={exportPDF} disabled={!period || displayShifts.length === 0}>
          <FileDown className="w-4 h-4 mr-1.5" />
          Export PDF
        </Button>
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
            <BulkAddShift onSubmit={bulkAddShifts} onCancel={() => setShowBulkForm(false)} settings={settings} />
          </div>
        )}

        {showForm && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <ShiftForm onSubmit={addShift} onCancel={() => setShowForm(false)} settings={settings} />
          </div>
        )}

        {editingShift && (
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <ShiftForm
              initial={editingShift.data}
              onSubmit={updateShift}
              onCancel={() => setEditingShift(null)}
              onDelete={(shiftData) => { deleteShift(shiftData, editingShift.index); setEditingShift(null); }}
              settings={settings}
            />
          </div>
        )}

        <div className="divide-y divide-border">
          {displayShifts.length === 0 && !showForm && !showBulkForm && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">No shifts logged for this pay period.</p>
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
              periodEndDate={period.end_date}
              onEdit={(s) => setEditingShift({ data: s, index: shift._origIdx })}
              onDelete={() => deleteShift(shift, shift._origIdx)}
              onVerify={() => verifyShift(shift, shift._origIdx)}
            />
          ))}
        </div>
      </div>

      {/* Verified Deductions Form */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Verified Deductions</h3>
            {hasVerifiedDeductions && (
              <span className="text-[11px] font-medium bg-chart-4/15 text-chart-4 px-1.5 py-0.5 rounded">From pay stub</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasVerifiedDeductions && (
              <Button variant="ghost" size="sm" onClick={clearDeductions} disabled={savingDeductions} className="h-8 text-xs text-muted-foreground">
                Clear
              </Button>
            )}
            <Button
              size="sm"
              onClick={saveDeductions}
              disabled={!deductionsDirty || savingDeductions}
              className="h-8 text-xs bg-primary text-primary-foreground"
            >
              {savingDeductions ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Save
            </Button>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground mb-4">
            Transcribe deductions from your pay stub for this period. Leave fields blank to use estimated values instead.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CPP</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Pay stub value"
                  value={deductionsForm?.cpp ?? ''}
                  onChange={e => setDeductionField('cpp', e.target.value)}
                  className="h-9 text-sm font-mono pl-6"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CPP2</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Pay stub value"
                  value={deductionsForm?.cpp2 ?? ''}
                  onChange={e => setDeductionField('cpp2', e.target.value)}
                  className="h-9 text-sm font-mono pl-6"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">EI</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Pay stub value"
                  value={deductionsForm?.ei ?? ''}
                  onChange={e => setDeductionField('ei', e.target.value)}
                  className="h-9 text-sm font-mono pl-6"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Federal Tax</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Pay stub value"
                  value={deductionsForm?.federal_tax ?? ''}
                  onChange={e => setDeductionField('federal_tax', e.target.value)}
                  className="h-9 text-sm font-mono pl-6"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Provincial Tax</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Pay stub value"
                  value={deductionsForm?.provincial_tax ?? ''}
                  onChange={e => setDeductionField('provincial_tax', e.target.value)}
                  className="h-9 text-sm font-mono pl-6"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Union Dues</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Pay stub value"
                  value={deductionsForm?.union_dues ?? ''}
                  onChange={e => setDeductionField('union_dues', e.target.value)}
                  className="h-9 text-sm font-mono pl-6"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Other Deductions</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Amount"
                  value={deductionsForm?.other_deductions ?? ''}
                  onChange={e => setDeductionField('other_deductions', e.target.value)}
                  className="h-9 text-sm font-mono pl-6"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Label (e.g. LTD, Health)</Label>
              <Input
                type="text"
                placeholder="e.g. LTD premium"
                value={deductionsForm?.other_label ?? ''}
                onChange={e => setDeductionText('other_label', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Input
                type="text"
                placeholder="e.g. stub dated Jun 13"
                value={deductionsForm?.notes ?? ''}
                onChange={e => setDeductionText('notes', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown — pass verified deductions */}
      {(breakdown || period.breakdown) && (
        <PayBreakdown
          breakdown={breakdown}
          wage={settings?.hourly_wage}
          taxSettings={settings?.tax_settings}
          verifiedDeductions={period.verified_deductions}
          title="Pay Period Breakdown"
        />
      )}
    </div>
  );
}