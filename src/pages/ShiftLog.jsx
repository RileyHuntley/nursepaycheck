import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import ShiftRow from '@/components/payroll/ShiftRow';
import ShiftForm from '@/components/payroll/ShiftForm';
import PayBreakdown from '@/components/payroll/PayBreakdown';
import ShiftCalendarGrid from '@/components/payroll/ShiftCalendarGrid';
import { calculatePeriodBreakdown, calculateShiftPremiums, getPayPeriodForDate, getPayPeriodName, isDuplicateShift, getFirstPeriodsOfMonths } from '@/lib/premiumCalculator';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowUpDown, Plus, CalendarPlus, List, CalendarDays, Filter, CheckSquare, X, Check, Trash2, Eye, EyeOff } from 'lucide-react';
import { PrivacyModeProvider, usePrivacyMode } from '@/contexts/PrivacyModeContext';
import PrivacyAmount from '@/components/payroll/PrivacyAmount';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import BulkAddShift from '@/components/payroll/BulkAddShift';
import EditShiftDialog from '@/components/payroll/EditShiftDialog';
import SetupBanner from '@/components/payroll/SetupBanner';
import { Checkbox } from '@/components/ui/checkbox';

export default function ShiftLog() {
  return (
    <PrivacyModeProvider>
      <ShiftLogInner />
    </PrivacyModeProvider>
  );
}

function ShiftLogInner() {
  const [settings, setSettings] = useState(null);
  const [allShifts, setAllShifts] = useState([]);
  const [periodMap, setPeriodMap] = useState({}); // id -> period
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(true);
  const [editingShift, setEditingShift] = useState(null); // { data, _periodId, _shiftIdx, isDuplicate? }
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'upcoming' | 'pending' | 'verified'
  const [visibleNextCount, setVisibleNextCount] = useState(1); // show current + N future periods
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(new Set()); // Set of "${_periodId}-${_shiftIdx}"

  const _today = new Date();
  const todayStr = `${_today.getFullYear()}-${String(_today.getMonth()+1).padStart(2,'0')}-${String(_today.getDate()).padStart(2,'0')}`;
  const resolveStatus = (shift) => {
    if (shift.status === 'verified') return 'verified';
    if (!shift.date) return 'upcoming';
    if (shift.date > todayStr) return 'upcoming';
    return 'pending';
  };

  const loadingRef = useRef(false);
  const loadRef = useRef(null);

  const loadData = useCallback(async () => {
    if (loadingRef.current) return;
    if (loadRef.current) { clearTimeout(loadRef.current); loadRef.current = null; }
    loadingRef.current = true;
    setLoading(true);
    try {
      const settingsList = await base44.entities.Settings.list();
      let periodList = await base44.entities.PayPeriod.list('-start_date', 100);

      // Auto-create default settings for new users
      if (settingsList.length === 0) {
        const created = await base44.entities.Settings.create({
          hourly_wage: 45,
          ot_multipliers: { overtime: 1.5, overtime_extended: 2, stat_holiday: 1.5, ot_stat_holiday: 3 },
          premium_rates: { evening: 1.4, night: 5, weekend: 3.5, super_shift: 1.85, regular_premium: 2.15, specialty: 2, short_notice: 2, responsibility_hourly: 2.5, responsibility_flat: 18.75, preceptor: 1.5, on_call_first_72: 7, on_call_beyond_72: 7.5 },
          preset_times: { day_12h_start: '07:00', day_12h_end: '19:00', night_12h_start: '19:00', night_12h_end: '07:00', day_8h_start: '08:00', day_8h_end: '16:00' },
          active_allowances: [],
          active_qualifications: [],
          hospitals: [],
          units: [],
          default_shift_pattern: 'DDNN',
        });
        settingsList = [created];
      }
      // Merge with defaults in case settings lack some fields
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

      // Deduplicate pay periods by date range — merge shifts into the first record, delete extras
      const dateGroups = {};
      for (const period of periodList) {
        const key = `${period.start_date}|${period.end_date}`;
        if (!dateGroups[key]) dateGroups[key] = [];
        dateGroups[key].push(period);
      }
      for (const [key, dupes] of Object.entries(dateGroups)) {
        if (dupes.length > 1) {
          // Merge all shifts into the first period, recalculate breakdown, delete the rest
          const [keeper, ...extras] = dupes;
          const allShifts = extras.reduce((acc, p) => acc.concat(p.shifts || []), keeper.shifts || []);
          const mergedSettings = settingsList.length > 0 ? settingsList[0] : null;
          const mergedBreakdown = mergedSettings ? calculatePeriodBreakdown(allShifts, mergedSettings, getFirstPeriodsOfMonths(periodList).has(keeper.start_date)) : null;
          await base44.entities.PayPeriod.update(keeper.id, {
            shifts: allShifts,
            ...(mergedBreakdown ? { breakdown: mergedBreakdown } : {}),
          });
          for (const extra of extras) {
            await base44.entities.PayPeriod.delete(extra.id);
          }
          // Reload after cleanup
          periodList = await base44.entities.PayPeriod.list('-start_date', 100);
        }
      }

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
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Debounced subscription reload to prevent rate limiting
  const debouncedLoad = useCallback(() => {
    if (loadRef.current) clearTimeout(loadRef.current);
    loadRef.current = setTimeout(() => loadData(), 700);
  }, [loadData]);

  useEffect(() => {
    const unsub1 = base44.entities.Settings.subscribe(() => debouncedLoad());
    const unsub2 = base44.entities.PayPeriod.subscribe(() => debouncedLoad());
    return () => { unsub1(); unsub2(); };
  }, [debouncedLoad]);

  // Compute which periods are first of their month with shifts
  const firstPeriodsSet = useMemo(() => getFirstPeriodsOfMonths(Object.values(periodMap)), [periodMap]);

  // Build shiftsMap for calendar view
  const shiftsMap = useMemo(() => {
    const map = {};
    for (const shift of allShifts) {
      if (!shift.date) continue;
      if (!map[shift.date]) map[shift.date] = [];
      map[shift.date].push({ ...shift, periodId: shift._periodId, periodName: shift._periodName, periodShiftIdx: shift._shiftIdx });
    }
    return map;
  }, [allShifts]);

  // Calendar shift update handler
  const calendarUpdateShift = async (shiftData, editingShift) => {
    const periodId = editingShift.periodId;
    const shiftIdx = editingShift.periodShiftIdx;

    if (shiftData.date !== editingShift.data.date) {
      const newPeriod = await findOrCreatePeriodForDate(shiftData.date);
      // Remove from old period
      const oldPeriod = periodMap[periodId];
      if (oldPeriod) {
        const oldShifts = (oldPeriod.shifts || []).filter((_, i) => i !== shiftIdx);
        const oldBreakdown = settings ? calculatePeriodBreakdown(oldShifts, settings, firstPeriodsSet.has(oldPeriod.start_date)) : null;
        await base44.entities.PayPeriod.update(oldPeriod.id, {
          shifts: oldShifts,
          ...(oldBreakdown ? { breakdown: oldBreakdown } : {}),
        });
      }
      // Add to new period
      const newShifts = [...(newPeriod.shifts || []), { ...shiftData }];
      const newBreakdown = settings ? calculatePeriodBreakdown(newShifts, settings, firstPeriodsSet.has(newPeriod.start_date)) : null;
      await base44.entities.PayPeriod.update(newPeriod.id, {
        shifts: newShifts,
        ...(newBreakdown ? { breakdown: newBreakdown } : {}),
      });
      return;
    }

    // Same period update
    const period = periodMap[periodId];
    if (!period) return;
    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === shiftIdx ? { ...shiftData } : s
    );
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, firstPeriodsSet.has(period.start_date)) : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown } : {}),
    });
  };

  const duplicateShift = (shift) => {
    setEditingShift({
      data: { ...shift, date: '', status: getDefaultStatus('') },
      _periodId: shift._periodId,
      _shiftIdx: shift._shiftIdx,
      isDuplicate: true,
    });
  };

  const updateShift = async (shiftData) => {
    // Duplicate mode: create new shift instead of updating
    if (editingShift.isDuplicate) {
      await addShift(shiftData);
      setEditingShift(null);
      return;
    }

    const oldPeriod = periodMap[editingShift._periodId];
    if (!oldPeriod) return;

    // If date changed outside current period, move the shift
    if (shiftData.date !== editingShift.data.date) {
      const newDates = getPayPeriodForDate(shiftData.date);
      const stillInOldPeriod = shiftData.date >= oldPeriod.start_date && shiftData.date <= oldPeriod.end_date;
      if (!stillInOldPeriod) {
        // Remove from old period
        const oldShifts = (oldPeriod.shifts || []).filter((_, i) => i !== editingShift._shiftIdx);
        const oldBreakdown = settings ? calculatePeriodBreakdown(oldShifts, settings, firstPeriodsSet.has(oldPeriod.start_date)) : null;
        await base44.entities.PayPeriod.update(oldPeriod.id, {
          shifts: oldShifts,
          ...(oldBreakdown ? { breakdown: oldBreakdown } : {}),
        });
        // Find or create new period
        const newPeriod = await findOrCreatePeriodForDate(shiftData.date);
        const newShifts = [...(newPeriod.shifts || []), { ...shiftData }];
        const newBreakdown = settings ? calculatePeriodBreakdown(newShifts, settings, firstPeriodsSet.has(newPeriod.start_date)) : null;
        await base44.entities.PayPeriod.update(newPeriod.id, {
          shifts: newShifts,
          ...(newBreakdown ? { breakdown: newBreakdown } : {}),
        });
        setEditingShift(null);
        loadData();
        return;
      }
    }

    const updatedShifts = (oldPeriod.shifts || []).map((s, i) =>
      i === editingShift._shiftIdx ? { ...shiftData } : s
    );
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, firstPeriodsSet.has(oldPeriod.start_date)) : null;
    await base44.entities.PayPeriod.update(oldPeriod.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown } : {}),
    });
    setEditingShift(null);
    loadData();
  };

  const deleteShift = async (shift) => {
    const period = periodMap[shift._periodId];
    if (!period) return;
    const updatedShifts = (period.shifts || []).filter((_, i) => i !== shift._shiftIdx);
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, firstPeriodsSet.has(period.start_date)) : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown } : {}),
    });
    loadData();
  };

  const verifyShift = async (shift) => {
    const period = periodMap[shift._periodId];
    if (!period) return;
    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === shift._shiftIdx ? { ...s, status: 'verified' } : s
    );
    await base44.entities.PayPeriod.update(period.id, { shifts: updatedShifts });
    loadData();
  };

  // ── Bulk operations ──
  const shiftKey = (s) => `${s._periodId}-${s._shiftIdx}`;

  const toggleSelectShift = (shift) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      const key = shiftKey(shift);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAllInGroup = (groupShifts) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      const allKeys = groupShifts.map(s => shiftKey(s));
      const allSelected = allKeys.every(k => next.has(k));
      if (allSelected) {
        allKeys.forEach(k => next.delete(k));
      } else {
        allKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedKeys(new Set());
  };

  const bulkVerify = async () => {
    // Group selected shifts by period
    const byPeriod = {};
    for (const key of selectedKeys) {
      const shift = allShifts.find(s => shiftKey(s) === key);
      if (!shift) continue;
      if (!byPeriod[shift._periodId]) byPeriod[shift._periodId] = [];
      byPeriod[shift._periodId].push(shift._shiftIdx);
    }
    for (const [periodId, indices] of Object.entries(byPeriod)) {
      const period = periodMap[periodId];
      if (!period) continue;
      const indexSet = new Set(indices);
      const updatedShifts = (period.shifts || []).map((s, i) =>
        indexSet.has(i) ? { ...s, status: 'verified' } : s
      );
      const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, firstPeriodsSet.has(period.start_date)) : null;
      await base44.entities.PayPeriod.update(period.id, {
        shifts: updatedShifts,
        ...(breakdown ? { breakdown } : {}),
      });
    }
    exitSelectionMode();
    loadData();
  };

  const bulkChangeType = async (newType) => {
    const byPeriod = {};
    for (const key of selectedKeys) {
      const shift = allShifts.find(s => shiftKey(s) === key);
      if (!shift) continue;
      if (!byPeriod[shift._periodId]) byPeriod[shift._periodId] = [];
      byPeriod[shift._periodId].push(shift._shiftIdx);
    }
    for (const [periodId, indices] of Object.entries(byPeriod)) {
      const period = periodMap[periodId];
      if (!period) continue;
      const indexSet = new Set(indices);
      const updatedShifts = (period.shifts || []).map((s, i) =>
        indexSet.has(i) ? { ...s, shift_type: newType } : s
      );
      const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, firstPeriodsSet.has(period.start_date)) : null;
      await base44.entities.PayPeriod.update(period.id, {
        shifts: updatedShifts,
        ...(breakdown ? { breakdown } : {}),
      });
    }
    exitSelectionMode();
    loadData();
  };

  const bulkDelete = async () => {
    const byPeriod = {};
    for (const key of selectedKeys) {
      const shift = allShifts.find(s => shiftKey(s) === key);
      if (!shift) continue;
      if (!byPeriod[shift._periodId]) byPeriod[shift._periodId] = new Set();
      byPeriod[shift._periodId].add(shift._shiftIdx);
    }
    for (const [periodId, indexSet] of Object.entries(byPeriod)) {
      const period = periodMap[periodId];
      if (!period) continue;
      const updatedShifts = (period.shifts || []).filter((_, i) => !indexSet.has(i));
      const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, firstPeriodsSet.has(period.start_date)) : null;
      await base44.entities.PayPeriod.update(period.id, {
        shifts: updatedShifts,
        ...(breakdown ? { breakdown } : {}),
      });
    }
    exitSelectionMode();
    loadData();
  };

  const findOrCreatePeriodForDate = async (date) => {
    const existing = Object.values(periodMap).find(p => date >= p.start_date && date <= p.end_date);
    if (existing) return existing;
    const { start_date, end_date } = getPayPeriodForDate(date);
    const created = await base44.entities.PayPeriod.create({
      name: getPayPeriodName(start_date, end_date),
      start_date,
      end_date,
      shifts: [],
      
    });
    setPeriodMap(prev => ({ ...prev, [created.id]: created }));
    return created;
  };

  const getDefaultStatus = (date) => { const _n = new Date(); const _s = `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`; return date > _s ? 'upcoming' : 'pending'; };

  const addShift = async (shiftData) => {
    const period = await findOrCreatePeriodForDate(shiftData.date);
    const periodShifts = period.shifts || [];

    // Check for duplicate: same date + same start_time + same end_time
    if (isDuplicateShift(periodShifts, shiftData)) {
      toast({ title: 'Duplicate shift', description: 'A shift with the same date, start, and end time already exists.', variant: 'destructive' });
      return;
    }

    const updatedShifts = [...periodShifts, { ...shiftData, status: shiftData.status || getDefaultStatus(shiftData.date) }];
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, firstPeriodsSet.has(period.start_date)) : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown } : {}),
    });
    setShowForm(false);
    loadData();
  };

  const bulkAddShifts = async (shifts) => {
    if (shifts.length === 0) return;
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
    setShowBulkForm(false);
    loadData();
  };

  // Only show full-page spinner on initial load (no data yet).
  // During refreshes, keep the calendar/list rendered so view state (month, etc.) persists.
  if (loading && allShifts.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sorted shifts (with optional status filter)
  const sortedShifts = [...allShifts]
    .filter(s => statusFilter === 'all' || resolveStatus(s) === statusFilter)
    .sort((a, b) => {
      const diff = (a.date || '').localeCompare(b.date || '');
      return sortAsc ? diff : -diff;
    });

  // Compute visible pay periods: current period + visibleNextCount future periods
  const currentPd = getPayPeriodForDate(todayStr);
  const currentPdKey = `${currentPd.start_date}|${currentPd.end_date}`;
  const lastVisibleStart = new Date(currentPd.start_date + 'T12:00:00');
  lastVisibleStart.setDate(lastVisibleStart.getDate() + 14 * visibleNextCount);
  const lastVisibleEnd = new Date(lastVisibleStart);
  lastVisibleEnd.setDate(lastVisibleStart.getDate() + 13);
  const lastVisibleEndStr = lastVisibleEnd.toISOString().split('T')[0];

  // Check if there are shifts beyond the last visible period
  const hasMoreFuture = allShifts.some(s => s.date > lastVisibleEndStr);

  // YTD breakdown: filter to current year up to today, compute per-period, sum
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const ytdAllShifts = allShifts.filter(s => s.date >= yearStart && s.date <= todayStr);

  // Group shifts by actual pay period (from date) and compute per-period breakdown, then sum
  let breakdown = null;
  if (settings && ytdAllShifts.length > 0) {
    const periodGroups = {};
    for (const s of ytdAllShifts) {
      const pd = getPayPeriodForDate(s.date);
      const key = `${pd.start_date}|${pd.end_date}`;
      if (!periodGroups[key]) periodGroups[key] = [];
      periodGroups[key].push(s);
    }
    breakdown = Object.values(periodGroups).reduce((acc, groupShifts) => {
      const cleanShifts = groupShifts.map(({ _periodName, _periodId, _periodStart, _shiftIdx, ...shift }) => shift);
      const pd = getPayPeriodForDate(cleanShifts[0]?.date || todayStr);
      const pb = calculatePeriodBreakdown(cleanShifts, settings, firstPeriodsSet.has(pd.start_date));
      return {
        straight_time_pay: (acc.straight_time_pay || 0) + pb.straight_time_pay,
        overtime_pay: (acc.overtime_pay || 0) + pb.overtime_pay,
        stat_pay: (acc.stat_pay || 0) + pb.stat_pay,
        regular_premium_total: (acc.regular_premium_total || 0) + pb.regular_premium_total,
        regular_premium_hours: (acc.regular_premium_hours || 0) + (pb.regular_premium_hours || 0),
        evening_premium_total: (acc.evening_premium_total || 0) + pb.evening_premium_total,
        evening_premium_hours: (acc.evening_premium_hours || 0) + (pb.evening_premium_hours || 0),
        night_premium_total: (acc.night_premium_total || 0) + pb.night_premium_total,
        night_premium_hours: (acc.night_premium_hours || 0) + (pb.night_premium_hours || 0),
        weekend_premium_total: (acc.weekend_premium_total || 0) + pb.weekend_premium_total,
        weekend_premium_hours: (acc.weekend_premium_hours || 0) + (pb.weekend_premium_hours || 0),
        super_shift_premium_total: (acc.super_shift_premium_total || 0) + pb.super_shift_premium_total,
        super_shift_premium_hours: (acc.super_shift_premium_hours || 0) + (pb.super_shift_premium_hours || 0),
        short_notice_total: (acc.short_notice_total || 0) + pb.short_notice_total,
        short_notice_hours: (acc.short_notice_hours || 0) + (pb.short_notice_hours || 0),
        responsibility_total: (acc.responsibility_total || 0) + pb.responsibility_total,
        responsibility_hours: (acc.responsibility_hours || 0) + (pb.responsibility_hours || 0),
        preceptor_total: (acc.preceptor_total || 0) + pb.preceptor_total,
        preceptor_hours: (acc.preceptor_hours || 0) + (pb.preceptor_hours || 0),
        specialty_premium_total: (acc.specialty_premium_total || 0) + pb.specialty_premium_total,
        specialty_premium_hours: (acc.specialty_premium_hours || 0) + (pb.specialty_premium_hours || 0),
        on_call_total: (acc.on_call_total || 0) + pb.on_call_total,
        on_call_hours: (acc.on_call_hours || 0) + (pb.on_call_hours || 0),
        allowance_total: (acc.allowance_total || 0) + pb.allowance_total,
        allowance_monthly: (acc.allowance_monthly || 0) + (pb.allowance_monthly || 0),
        qualification_total: (acc.qualification_total || 0) + pb.qualification_total,
        qualification_annual: (acc.qualification_annual || 0) + (pb.qualification_annual || 0),
        qualification_hourly: pb.qualification_hourly,  // same per-hour rate
        union_dues: (acc.union_dues || 0) + pb.union_dues,
        gross_pay: (acc.gross_pay || 0) + pb.gross_pay,
        regular_hours: (acc.regular_hours || 0) + pb.regular_hours,
        overtime_detail: null, // detail too complex to merge; drop in YTD
      };
    }, {});
  }

  const { privacyMode, togglePrivacyMode } = usePrivacyMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Shifts</h2>
            <button
              onClick={togglePrivacyMode}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={privacyMode ? 'Show amounts' : 'Hide amounts'}
            >
              {privacyMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {viewMode === 'list' && (
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter !== 'all'
                ? `${sortedShifts.length} shift${sortedShifts.length !== 1 ? 's' : ''} · ${statusFilter}`
                : `Current + upcoming periods shown — past periods with pending shifts also visible`
              }
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Calendar
            </button>
          </div>
          {viewMode === 'list' && (
            <>
              <Button
                variant={selectionMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => { if (selectionMode) exitSelectionMode(); else setSelectionMode(true); }}
                className={`h-8 px-2.5 text-xs ${selectionMode ? 'bg-primary text-primary-foreground' : ''}`}
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1" />
                {selectionMode ? `Selected (${selectedKeys.size})` : 'Select'}
              </Button>
              {!selectionMode && (
                <>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                      <Filter className="w-3 h-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setSortAsc(s => !s)} className="h-8 px-2 text-xs text-muted-foreground">
                    <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                    {sortAsc ? 'Oldest first' : 'Newest first'}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <ShiftCalendarGrid
          settings={settings}
          shiftsMap={shiftsMap}
          onShiftUpdate={calendarUpdateShift}
          onReload={loadData}
          showHeader={false}
        />
      ) : (
        <>
          {allShifts.length === 0 && !loading && (
            <SetupBanner
              hasShifts={false}
              hasWage={settings && settings.hourly_wage !== 45}
              hasTaxSettings={settings?.tax_settings?.annual_federal_income > 0 || settings?.tax_settings?.annual_provincial_income > 0}
              hasHospitals={(settings?.hospitals?.length || 0) > 0 && (settings?.units?.length || 0) > 0}
            />
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

            {/* Bulk action toolbar */}
            {selectionMode && selectedKeys.size > 0 && (
              <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-foreground">{selectedKeys.size} selected</span>
                <Button size="sm" variant="outline" onClick={bulkVerify} className="h-8 text-xs">
                  <Check className="w-3.5 h-3.5 mr-1" /> Mark Verified
                </Button>
                <Select onValueChange={(v) => bulkChangeType(v)}>
                  <SelectTrigger className="h-8 w-[170px] text-xs">
                    <SelectValue placeholder="Change type…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual Shift</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="day_off">Day Off</SelectItem>
                    <SelectItem value="isn">ISN</SelectItem>
                    <SelectItem value="vacation">Paid Vacation</SelectItem>
                    <SelectItem value="sick">Paid Sick</SelectItem>
                    <SelectItem value="unpaid_vacation">Unpaid Vacation</SelectItem>
                    <SelectItem value="unpaid_sick">Unpaid Sick</SelectItem>
                    <SelectItem value="special_leave">Special Leave</SelectItem>
                    <SelectItem value="pdo_pst">PDO/PST</SelectItem>
                    <SelectItem value="other_leave">Other Leave</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="destructive" onClick={bulkDelete} className="h-8 text-xs ml-auto">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Selected
                </Button>
              </div>
            )}
            <div>
              {(() => {
                // Group shifts by actual pay period dates (deduplicates across duplicate DB records)
                const groups = [];
                const seen = new Set();
                for (const shift of sortedShifts) {
                  const pd = getPayPeriodForDate(shift.date);
                  const key = `${pd.start_date}|${pd.end_date}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    groups.push({ key, periodName: getPayPeriodName(pd.start_date, pd.end_date), periodStart: pd.start_date, periodEnd: pd.end_date, shifts: [] });
                  }
                  groups[groups.length - 1].shifts.push(shift);
                }

                // Filter: current + N future always shown; past periods only if they have a pending shift
                const visibleGroups = groups.filter(g => {
                  if (g.periodStart >= currentPd.start_date && g.periodStart <= lastVisibleEndStr) return true; // current/future
                  if (g.periodStart < currentPd.start_date) return g.shifts.some(s => resolveStatus(s) === 'pending'); // past: only if pending
                  return false;
                });
                // Show current period even if empty
                const hasCurrentGroup = visibleGroups.some(g => g.key === currentPdKey);
                if (!hasCurrentGroup && currentPdKey) {
                  visibleGroups.unshift({
                    key: currentPdKey,
                    periodName: getPayPeriodName(currentPd.start_date, currentPd.end_date),
                    periodStart: currentPd.start_date,
                    periodEnd: currentPd.end_date,
                    shifts: [],
                  });
                }

                return (
                  <>
                    {visibleGroups.map((group) => {
                      const periodBreakdown = settings && group.shifts.length > 0 ? calculatePeriodBreakdown(group.shifts, settings, firstPeriodsSet.has(group.periodStart)) : null;
                      return (
                        <div key={group.key}>
                          <div className="px-4 py-3 bg-secondary/30 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {selectionMode && group.shifts.length > 0 && (() => {
                                const allKeys = group.shifts.map(s => shiftKey(s));
                                const allSelected = allKeys.length > 0 && allKeys.every(k => selectedKeys.has(k));
                                const someSelected = allKeys.some(k => selectedKeys.has(k));
                                return (
                                  <Checkbox
                                    checked={allSelected}
                                    className={someSelected && !allSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                                    onCheckedChange={() => selectAllInGroup(group.shifts)}
                                  />
                                );
                              })()}
                              <h4 className="text-sm font-semibold text-foreground">
                                {group.periodName}
                              </h4>
                              <span className="text-xs text-muted-foreground">
                                {group.shifts.length} shift{group.shifts.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {periodBreakdown && (
                              <PrivacyAmount
                                value={periodBreakdown.gross_pay}
                                className="text-sm font-mono font-semibold text-primary"
                              />
                            )}
                          </div>
                          <div className="divide-y divide-border">
                            {group.shifts.map((shift) => (
                              <div key={`${shift._periodId}-${shift._shiftIdx}`} className="bg-muted/20 hover:bg-muted/30">
                                <ShiftRow
                                  shift={shift}
                                  premiums={settings ? calculateShiftPremiums(shift, settings) : null}
                                  settings={settings}
                                  periodEndDate={group.periodEnd}
                                  hidePending={group.key === currentPdKey}
                                  onEdit={(s) => setEditingShift({ data: s, _periodId: shift._periodId, _shiftIdx: shift._shiftIdx })}
                                  onDelete={() => deleteShift(shift)}
                                  onVerify={() => verifyShift(shift)}
                                  onDuplicate={() => duplicateShift(shift)}
                                  selectable={selectionMode}
                                  selected={selectedKeys.has(shiftKey(shift))}
                                  onToggleSelect={toggleSelectShift}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {hasMoreFuture && (
                      <div className="px-4 py-3 flex justify-center border-t border-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVisibleNextCount(c => c + 1)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Load next pay period
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {breakdown && (
            <PayBreakdown breakdown={breakdown} wage={settings?.hourly_wage} title="Year-to-Date Breakdown" taxSettings={settings?.tax_settings} />
          )}
        </>
      )}

      <EditShiftDialog
        editingShift={editingShift}
        settings={settings}
        onSubmit={updateShift}
        onClose={() => setEditingShift(null)}
        onDelete={(shiftData) => {
          deleteShift({ data: shiftData, _periodId: editingShift._periodId, _shiftIdx: editingShift._shiftIdx });
          setEditingShift(null);
        }}
      />
    </div>
  );
}