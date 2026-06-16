import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, Loader2, Filter, X } from 'lucide-react';
import { getStatType, getStatName, getPayDate } from '@/lib/statHolidays';
import ShiftForm from '@/components/payroll/ShiftForm';
import { calculatePeriodBreakdown, calculateShiftPremiums } from '@/lib/premiumCalculator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_COLORS = {
  regular:         'bg-chart-3/15 text-chart-3 border-chart-3/30',
  day_off:         'bg-chart-2/15 text-chart-2 border-chart-2/30',
  work_stat:       'bg-chart-5/15 text-chart-5 border-chart-5/30',
  work_super_stat: 'bg-destructive/15 text-destructive border-destructive/30',
  ot_stat:         'bg-destructive/15 text-destructive border-destructive/30',
  overtime:        'bg-chart-2/15 text-chart-2 border-chart-2/30',
  isn:             'bg-chart-3/15 text-chart-3 border-chart-3/30',
  vacation:        'bg-chart-4/15 text-chart-4 border-chart-4/30',
  sick:            'bg-chart-1/15 text-chart-1 border-chart-1/30',
  pdo_pst:         'bg-muted text-muted-foreground border-border',
  other_leave:     'bg-muted text-muted-foreground border-border',
};

const TYPE_SHORT = {
  regular: 'Reg', day_off: 'DO', work_stat: 'Stat', work_super_stat: 'Super',
  ot_stat: 'OT×Stat', overtime: 'OT', isn: 'ISN', vacation: 'Vac',
  sick: 'Sick', pdo_pst: 'PDO', other_leave: 'Off',
};

export default function ShiftCalendar() {
  const [settings, setSettings] = useState(null);
  const [shiftsMap, setShiftsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingShift, setEditingShift] = useState(null); // { data, periodId }
  const [hospitalFilter, setHospitalFilter] = useState('all');
  const [haFilter, setHaFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

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

  useEffect(() => {
    const unsub1 = base44.entities.Settings.subscribe(() => loadShifts());
    const unsub2 = base44.entities.PayPeriod.subscribe(() => loadShifts());
    return () => { unsub1(); unsub2(); };
  }, [loadShifts]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Build month grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun

  const daysInMonth = lastDay.getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  const cells = [];
  // Empty cells before first day
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null, dateStr: null });
  }
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const updateShift = async (shiftData) => {
    if (!editingShift) return;
    const periodList = await base44.entities.PayPeriod.list('-start_date', 100);
    const period = periodList.find(p => p.id === editingShift.periodId);
    if (!period) return;
    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === editingShift.periodShiftIdx ? { ...shiftData } : s
    );
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings) : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown, status: 'calculated' } : {}),
    });
    setEditingShift(null);
    loadShifts();
  };

  const monthLabel = viewDate.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  // Derive filter options from all shifts + settings
  const allShifts = Object.values(shiftsMap).flat();
  const hospitals = settings?.hospitals || [];
  const units = settings?.units || [];

  // Unique hospitals from shifts
  const shiftHospitals = [...new Set(allShifts.map(s => s.hospital).filter(Boolean))];

  // Unique HAs from shifts (via settings lookups)
  const shiftHAs = [...new Set(shiftHospitals.map(hName => {
    const h = hospitals.find(x => x.name === hName);
    return h?.health_authority || null;
  }).filter(Boolean))];

  // Unique unit combos: "ACRONYM CODE" keyed by unit name (so filtering is consistent)
  const unitCombos = [...new Set(allShifts
    .filter(s => s.hospital && s.unit)
    .map(s => {
      const h = hospitals.find(x => x.name === s.hospital);
      const u = units.find(x => x.name === s.unit);
      return `${h?.acronym || s.hospital} ${u?.code || s.unit}`;
    })
  )].sort();

  // Build a lookup: "ACRONYM CODE" → unit name (for filtering purposes, we filter by unit name)
  const unitComboToName = {};
  allShifts.filter(s => s.hospital && s.unit).forEach(s => {
    const h = hospitals.find(x => x.name === s.hospital);
    const u = units.find(x => x.name === s.unit);
    const combo = `${h?.acronym || s.hospital} ${u?.code || s.unit}`;
    if (!unitComboToName[combo]) unitComboToName[combo] = s.unit;
  });

  // Apply filters to shiftsMap
  const filteredMap = {};
  for (const [dateStr, shifts] of Object.entries(shiftsMap)) {
    const filtered = shifts.filter(s => {
      if (hospitalFilter !== 'all' && s.hospital !== hospitalFilter) return false;
      if (haFilter !== 'all') {
        const h = hospitals.find(x => x.name === s.hospital);
        if (!h || h.health_authority !== haFilter) return false;
      }
      if (unitFilter !== 'all') {
        const targetUnitName = unitComboToName[unitFilter];
        if (!targetUnitName || s.unit !== targetUnitName) return false;
      }
      return true;
    });
    if (filtered.length > 0) filteredMap[dateStr] = filtered;
  }

  // When HA changes, reset hospital filter; when hospital changes, reset unit filter
  // (handled by onChange handlers)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Shift Calendar</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {editingShift && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <ShiftForm
            initial={editingShift.data}
            onSubmit={updateShift}
            onCancel={() => setEditingShift(null)}
            settings={settings}
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs font-medium text-muted-foreground mr-1">Filters:</span>

          {/* Hospital filter */}
          <Select
            value={hospitalFilter}
            onValueChange={(v) => { setHospitalFilter(v); setUnitFilter('all'); }}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All Hospitals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Hospitals</SelectItem>
              {shiftHospitals.map(hName => {
                const h = hospitals.find(x => x.name === hName);
                return (
                  <SelectItem key={hName} value={hName}>
                    {h?.acronym ? `${h.acronym} — ${hName}` : hName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Health Authority filter */}
          <Select
            value={haFilter}
            onValueChange={(v) => { setHaFilter(v); setHospitalFilter('all'); setUnitFilter('all'); }}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All Health Authorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Health Authorities</SelectItem>
              {shiftHAs.map(ha => (
                <SelectItem key={ha} value={ha}>{ha}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Unit filter */}
          <Select
            value={unitFilter}
            onValueChange={setUnitFilter}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All Units" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              {unitCombos.map(combo => (
                <SelectItem key={combo} value={combo}>{combo}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(hospitalFilter !== 'all' || haFilter !== 'all' || unitFilter !== 'all') && (
            <button
              onClick={() => { setHospitalFilter('all'); setHaFilter('all'); setUnitFilter('all'); }}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 auto-rows-fr">
          {cells.map((cell, idx) => {
            if (cell.day === null) {
              return <div key={`empty-${idx}`} className="min-h-[80px] bg-muted/20 border-b border-r border-border" />;
            }

            const isToday = cell.dateStr === todayStr;
            const shifts = filteredMap[cell.dateStr] || [];
            const statType = getStatType(cell.dateStr);
            const statName = getStatName(cell.dateStr);
            const payPeriod = getPayDate(cell.dateStr);

            return (
              <div
                key={cell.dateStr}
                className={`min-h-[80px] border-b border-r border-border flex flex-col ${
                  statType === 'super_stat' ? 'bg-destructive/5' :
                  statType === 'stat' ? 'bg-chart-5/5' :
                  isToday ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'bg-card'
                }`}
              >
                <div className="px-2 pt-1.5 flex items-start justify-between gap-1">
                  <span className={`text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}>
                    {cell.day}
                  </span>
                  <div className="flex items-center gap-0.5 flex-wrap justify-end">
                    {payPeriod && (
                      <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1 py-0.5 rounded leading-none">
                        PAY
                      </span>
                    )}
                    {statType === 'super_stat' && (
                      <span title={statName} className="text-[9px] font-bold bg-destructive text-destructive-foreground px-1 py-0.5 rounded leading-none">
                        ⭐S-STAT
                      </span>
                    )}
                    {statType === 'stat' && (
                      <span title={statName} className="text-[9px] font-bold bg-chart-5/80 text-white px-1 py-0.5 rounded leading-none">
                        STAT
                      </span>
                    )}
                  </div>
                </div>
                {(statType || payPeriod) && (
                  <div className="px-2 text-[9px] text-muted-foreground leading-tight mb-0.5">
                    {statName && <span>{statName}</span>}
                    {payPeriod && !statName && <span>PP {payPeriod.id}</span>}
                  </div>
                )}
                <div className="flex-1 px-1.5 pb-1.5 space-y-0.5">
                  {shifts.map((shift, si) => {
                    const colors = TYPE_COLORS[shift.shift_type] || TYPE_COLORS.regular;
                    return (
                      <button
                        key={si}
                        onClick={() => setEditingShift({ data: shift, periodId: shift.periodId, periodShiftIdx: shift.periodShiftIdx })}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] leading-tight border ${colors} hover:brightness-95 transition-all cursor-pointer`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">{TYPE_SHORT[shift.shift_type] || shift.shift_type}</span>
                          <span className="opacity-70 font-mono">{shift.start_time}–{shift.end_time}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] opacity-80">
                          <span className="font-mono">{shift.paid_hours}h paid</span>
                          {shift.extended_shift && <span className="text-destructive font-medium">Ext</span>}
                          {shift.short_notice && <span className="font-medium">Notice</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {Object.keys(filteredMap).length} shift day{Object.keys(filteredMap).length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1 py-0.5 rounded">PAY</span> Pay Day
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="text-[9px] font-bold bg-chart-5/80 text-white px-1 py-0.5 rounded">STAT</span> Stat Holiday
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="text-[9px] font-bold bg-destructive text-destructive-foreground px-1 py-0.5 rounded">⭐S-STAT</span> Super Stat
          </span>
          {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'regular').map(([key, colors]) => (
            <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${colors}`}>
              {TYPE_SHORT[key]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}