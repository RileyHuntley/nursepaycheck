import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import ShiftRow from '@/components/payroll/ShiftRow';
import ShiftForm from '@/components/payroll/ShiftForm';
import PayBreakdown from '@/components/payroll/PayBreakdown';
import ShiftCalendarGrid from '@/components/payroll/ShiftCalendarGrid';
import { calculatePeriodBreakdown, calculateShiftPremiums, getPayPeriodForDate, getPayPeriodName } from '@/lib/premiumCalculator';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowUpDown, Plus, CalendarPlus, List, CalendarDays } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'

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
        const oldBreakdown = settings ? calculatePeriodBreakdown(oldShifts, settings) : null;
        await base44.entities.PayPeriod.update(oldPeriod.id, {
          shifts: oldShifts,
          ...(oldBreakdown ? { breakdown: oldBreakdown, status: 'calculated' } : { status: 'draft' }),
        });
      }
      // Add to new period
      const newShifts = [...(newPeriod.shifts || []), { ...shiftData }];
      const newBreakdown = settings ? calculatePeriodBreakdown(newShifts, settings) : null;
      await base44.entities.PayPeriod.update(newPeriod.id, {
        shifts: newShifts,
        ...(newBreakdown ? { breakdown: newBreakdown, status: 'calculated' } : {}),
      });
      return;
    }

    // Same period update
    const period = periodMap[periodId];
    if (!period) return;
    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === shiftIdx ? { ...shiftData } : s
    );
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
  };

  const updateShift = async (shiftData) => {
    const oldPeriod = periodMap[editingShift._periodId];
    if (!oldPeriod) return;

    // If date changed outside current period, move the shift
    if (shiftData.date !== editingShift.data.date) {
      const newDates = getPayPeriodForDate(shiftData.date);
      const stillInOldPeriod = shiftData.date >= oldPeriod.start_date && shiftData.date <= oldPeriod.end_date;
      if (!stillInOldPeriod) {
        // Remove from old period
        const oldShifts = (oldPeriod.shifts || []).filter((_, i) => i !== editingShift._shiftIdx);
        const oldBreakdown = settings ? calculatePeriodBreakdown(oldShifts, settings) : null;
        await base44.entities.PayPeriod.update(oldPeriod.id, {
          shifts: oldShifts,
          ...(oldBreakdown ? { breakdown: oldBreakdown, status: 'calculated' } : { status: 'draft' }),
        });
        // Find or create new period
        const newPeriod = await findOrCreatePeriodForDate(shiftData.date);
        const newShifts = [...(newPeriod.shifts || []), { ...shiftData }];
        const newBreakdown = settings ? calculatePeriodBreakdown(newShifts, settings) : null;
        await base44.entities.PayPeriod.update(newPeriod.id, {
          shifts: newShifts,
          ...(newBreakdown ? { breakdown: newBreakdown, status: 'calculated' } : {}),
        });
        setEditingShift(null);
        loadData();
        return;
      }
    }

    const updatedShifts = (oldPeriod.shifts || []).map((s, i) =>
      i === editingShift._shiftIdx ? { ...shiftData } : s
    );
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    await base44.entities.PayPeriod.update(oldPeriod.id, {
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

  const findOrCreatePeriodForDate = async (date) => {
    const existing = Object.values(periodMap).find(p => date >= p.start_date && date <= p.end_date);
    if (existing) return existing;
    const { start_date, end_date } = getPayPeriodForDate(date);
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
    const period = await findOrCreatePeriodForDate(shiftData.date);
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
    // Group shifts by their period, find/create each period, update accordingly
    const groups = {};
    for (const s of shifts) {
      const period = await findOrCreatePeriodForDate(s.date);
      if (!groups[period.id]) groups[period.id] = { period, shifts: [] };
      groups[period.id].shifts.push({ ...s });
    }
    for (const { period, shifts: groupShifts } of Object.values(groups)) {
      const updatedShifts = [...(period.shifts || []), ...groupShifts];
      const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
      await base44.entities.PayPeriod.update(period.id, {
        shifts: updatedShifts,
        ...(breakdown ? { breakdown, status: 'calculated' } : {}),
      });
    }
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

  // YTD breakdown: filter to current year, compute per-period, sum
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const ytdAllShifts = allShifts.filter(s => s.date >= yearStart);
  const ytdPeriodKeys = new Set(ytdAllShifts.map(s => {
    const pd = getPayPeriodForDate(s.date);
    return `${pd.start_date}|${pd.end_date}`;
  }));

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
      const pb = calculatePeriodBreakdown(cleanShifts, settings);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Shift Log</h2>
          {viewMode === 'list' && (
            <p className="text-sm text-muted-foreground mt-1">
              {ytdAllShifts.length} shift{ytdAllShifts.length !== 1 ? 's' : ''} in {currentYear} across {ytdPeriodKeys.size} pay period{ytdPeriodKeys.size !== 1 ? 's' : ''} — Year-to-Date
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
            <Button variant="ghost" size="sm" onClick={() => setSortAsc(s => !s)} className="h-8 px-2 text-xs text-muted-foreground">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
              {sortAsc ? 'Oldest first' : 'Newest first'}
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <ShiftCalendarGrid
          settings={settings}
          shiftsMap={shiftsMap}
          onShiftUpdate={calendarUpdateShift}
          onReload={loadData}
        />
      ) : (
        <>
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
                    {(() => {
                      const pd = getPayPeriodForDate(shift.date);
                      return getPayPeriodName(pd.start_date, pd.end_date);
                    })()}
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
            <PayBreakdown breakdown={breakdown} wage={settings?.hourly_wage} title="Year-to-Date Breakdown" />
          )}
        </>
      )}
    </div>
  );
}