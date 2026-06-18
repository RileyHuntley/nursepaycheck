import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Filter, X, Calendar } from 'lucide-react';
import { getStatType, getStatName, getPayDate } from '@/lib/statHolidays';
import EditShiftDialog from '@/components/payroll/EditShiftDialog';
import { calculatePeriodBreakdown, calculateShiftPremiums, getPayPeriodForDate, getPayPeriodName } from '@/lib/premiumCalculator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_COLORS = {
  day_off:         'bg-chart-2/15 text-chart-2 border-chart-2/30',
  work_stat:       'bg-destructive/15 text-destructive border-destructive/30',
  work_super_stat: 'bg-destructive/15 text-destructive border-destructive/30',
  ot_stat:         'bg-destructive/15 text-destructive border-destructive/30',
  overtime:        'bg-chart-2/15 text-chart-2 border-chart-2/30',
  isn:             'bg-chart-3/15 text-chart-3 border-chart-3/30',
  vacation:        'bg-chart-4/15 text-chart-4 border-chart-4/30',
  sick:            'bg-chart-1/15 text-chart-1 border-chart-1/30',
  pdo_pst:         'bg-muted text-muted-foreground border-border',
  other_leave:     'bg-muted text-muted-foreground border-border',
};

const NIGHT_COLOR = 'bg-chart-3/15 text-chart-3 border-chart-3/30';
const DAY_COLOR   = 'bg-chart-2/15 text-chart-2 border-chart-2/30';

function getShiftColor(isNight) {
  return isNight ? NIGHT_COLOR : DAY_COLOR;
}

const TYPE_SHORT = {
  regular: 'Reg', day_off: 'DO', work_stat: 'Stat', work_super_stat: 'Super',
  ot_stat: 'OT×Stat', overtime: 'OT', isn: 'ISN', vacation: 'Vac',
  sick: 'Sick', pdo_pst: 'PDO', other_leave: 'Off',
};

const HA_FULL_NAMES = {
  VCH:   'Vancouver Coastal Health',
  FH:    'Fraser Health',
  VIHA:  'Island Health',
  IH:    'Interior Health',
  NH:    'Northern Health',
  PHSA:  'Provincial Health Services Authority',
  PHC:   'Providence Health Care',
};

export default function ShiftCalendarGrid({ settings, shiftsMap, onShiftUpdate, onReload, showHeader = true, readOnly = false, periodStart, periodEnd, periodNav }) {
  const [editingShift, setEditingShift] = useState(null);
  const [hospitalFilter, setHospitalFilter] = useState('all');
  const [haFilter, setHaFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [viewDate, setViewDate] = useState(() => {
    if (periodStart) {
      const d = new Date(periodStart + 'T12:00:00');
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const periodRefs = useRef(new Map());

  useEffect(() => {
    if (pickerOpen && periodNav?.currentId) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = periodRefs.current.get(periodNav.currentId);
          if (el) {
            el.scrollIntoView({ block: 'center' });
          }
        });
      });
    }
  }, [pickerOpen, periodNav?.currentId]);

  // Sync calendar month when period changes
  useEffect(() => {
    if (periodStart) {
      const d = new Date(periodStart + 'T12:00:00');
      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [periodStart]);

  const goToMonth = (m, y) => {
    setViewDate(new Date(y, m, 1));
    setPickerOpen(false);
  };
  const goToToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setPickerOpen(false);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  const prevMonthNum = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonthNum = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const prevMonthLast = new Date(year, month, 0).getDate();
  const nextMonthLast = new Date(nextYear, nextMonthNum + 1, 0).getDate();

  const cells = [];

  // Leading days from previous month (fill all start-offset boxes)
  for (let d = prevMonthLast - startOffset + 1; d <= prevMonthLast; d++) {
    const dateStr = `${prevYear}-${String(prevMonthNum + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, isAdjacentMonth: true });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }

  // Trailing days from next month: pay-period overflow + fill remaining row slots
  let periodEndDay = 0;
  if (periodStart && periodEnd) {
    const periodEndDate = new Date(periodEnd + 'T12:00:00');
    if (periodEndDate > lastDay) {
      periodEndDay = periodEndDate.getDate();
      for (let d = 1; d <= periodEndDay; d++) {
        const dateStr = `${nextYear}-${String(nextMonthNum + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ day: d, dateStr, isAdjacentMonth: true });
      }
    }
  }
  // Fill remaining boxes to complete the grid row(s)
  const remaining = (7 - (cells.length % 7)) % 7;
  if (remaining > 0) {
    const startFrom = periodEndDay > 0 ? periodEndDay + 1 : 1;
    for (let d = startFrom; d < startFrom + remaining && d <= nextMonthLast; d++) {
      const dateStr = `${nextYear}-${String(nextMonthNum + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateStr, isAdjacentMonth: true });
    }
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const handleUpdateShift = async (shiftData) => {
    if (!editingShift) return;
    if (onShiftUpdate) {
      await onShiftUpdate(shiftData, editingShift);
    }
    setEditingShift(null);
    if (onReload) onReload();
  };

  // Derive filter options + abbreviation visibility
  const allShifts = Object.values(shiftsMap).flat();
  const hospitals = settings?.hospitals || [];
  const units = settings?.units || [];

  // Show hospital/unit abbreviations only when shifts span more than one
  const uniqueHospitals = new Set(allShifts.map(s => s.hospital).filter(Boolean));
  const uniqueUnits = new Set(allShifts.map(s => s.unit).filter(Boolean));
  const showHospitalAbbr = uniqueHospitals.size > 1;
  const showUnitAbbr = uniqueUnits.size > 1;

  const shiftHospitals = [...new Set(allShifts.map(s => s.hospital).filter(Boolean))];

  const shiftHAs = [...new Set(shiftHospitals.map(hName => {
    const h = hospitals.find(x => x.name === hName);
    return h?.health_authority || null;
  }).filter(Boolean))];

  const { unitOptions, unitComboToName } = useMemo(() => {
    const opts = [];
    const comboMap = {};
    const seen = new Set();
    allShifts.filter(s => s.hospital && s.unit).forEach(s => {
      const h = hospitals.find(x => x.name === s.hospital);
      const u = units.find(x => x.name === s.unit);
      const combo = `${h?.acronym || s.hospital} ${u?.code || s.unit}`;
      if (seen.has(combo)) return;
      seen.add(combo);
      comboMap[combo] = s.unit;
      opts.push({ value: combo, label: `${u?.name || s.unit} [${combo}]` });
    });
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return { unitOptions: opts, unitComboToName: comboMap };
  }, [allShifts, hospitals, units]);

  const showHospitalFilter = shiftHospitals.length > 1;
  const showUnitFilter = unitOptions.length > 1;
  const showFilters = showHospitalFilter || showUnitFilter || shiftHAs.length > 1;

  // Apply filters
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

  const monthLabel = viewDate.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {showHeader && (
        <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Shift Calendar</h2>
      )}
      <div className="flex items-center justify-center gap-2">
        {periodNav ? (
          <>
            <button
              onClick={periodNav.onPrev}
              disabled={!periodNav.hasPrev?.()}
              className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-2 text-sm font-semibold text-foreground min-w-[200px] justify-center px-3 py-1 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  {periodNav.badge && (
                    <span className="text-[11px] font-mono font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      PP {periodNav.badge}
                    </span>
                  )}
                  <span>{periodNav.label}</span>
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="center">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground">Pay Periods</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {periodNav.periods?.map((p) => (
                    <button
                      key={p.id}
                      ref={(el) => { if (el) periodRefs.current.set(p.id, el); else periodRefs.current.delete(p.id); }}
                      onClick={() => { periodNav.onSelectPeriod?.(p.id); setPickerOpen(false); }}
                      className={`w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 ${
                        p.id === periodNav.currentId ? 'bg-primary/10' : ''
                      }`}
                    >
                      {p.badge && (
                        <span className="text-[10px] font-mono font-bold bg-muted text-muted-foreground px-1 py-0.5 rounded flex-shrink-0">
                          PP {p.badge}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium block truncate">{p.label}</span>
                        <span className="text-[10px] text-muted-foreground">{p.shiftCount} shift{p.shiftCount !== 1 ? 's' : ''}</span>
                      </div>
                    </button>
                  ))}
                  {(!periodNav.periods || periodNav.periods.length === 0) && (
                    <p className="px-3 py-4 text-xs text-muted-foreground text-center">No pay periods yet.</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <button
              onClick={periodNav.onNext}
              disabled={!periodNav.hasNext?.()}
              className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        ) : (
          <>
            <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground min-w-[140px] justify-center px-3 py-1 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  {monthLabel}
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-3" align="center">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Select value={String(month)} onValueChange={(v) => goToMonth(parseInt(v), year)}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['January','February','March','April','May','June',
                          'July','August','September','October','November','December']
                          .map((m, i) => (
                            <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(year)} onValueChange={(v) => goToMonth(month, parseInt(v))}>
                      <SelectTrigger className="h-8 text-xs w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 11 }, (_, i) => year - 5 + i).map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    onClick={goToToday}
                    className="w-full text-xs font-medium text-primary hover:bg-accent hover:text-accent-foreground rounded-md py-1.5 transition-colors"
                  >
                    Jump to Today
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {!readOnly && (
        <EditShiftDialog
          editingShift={editingShift}
          settings={settings}
          onSubmit={handleUpdateShift}
          onClose={() => setEditingShift(null)}
        />
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-medium text-muted-foreground mr-1">Filters:</span>

            {showHospitalFilter && (
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
            )}

            {shiftHAs.length > 1 && (
              <Select
                value={haFilter}
                onValueChange={(v) => { setHaFilter(v); setHospitalFilter('all'); setUnitFilter('all'); }}
              >
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue placeholder="All Health Authorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Health Authorities</SelectItem>
                  {shiftHAs.map(ha => (
                    <SelectItem key={ha} value={ha}>{HA_FULL_NAMES[ha] || ha}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {showUnitFilter && (
              <Select
                value={unitFilter}
                onValueChange={setUnitFilter}
              >
                <SelectTrigger className="h-8 w-[220px] text-xs">
                  <SelectValue placeholder="All Units" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Units</SelectItem>
                  {unitOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

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
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-fr">
          {cells.map((cell, idx) => {
            if (cell.day === null) {
              return <div key={`empty-${idx}`} className="min-h-[80px] bg-muted/20 border-b border-r border-border" />;
            }

            const isToday = cell.dateStr === todayStr;
            const isOutsidePeriod = periodStart && periodEnd && (cell.dateStr < periodStart || cell.dateStr > periodEnd);
            const shifts = filteredMap[cell.dateStr] || [];
            const statType = getStatType(cell.dateStr);
            const statName = getStatName(cell.dateStr);
            const payPeriod = getPayDate(cell.dateStr);
            const shiftTypes = [...new Set(shifts.map(s => TYPE_SHORT[s.shift_type] || s.shift_type))];

            let bgClass = 'bg-card';
            if (isOutsidePeriod) bgClass = 'bg-muted/50 opacity-50';
            else if (statType === 'super_stat' || statType === 'stat') bgClass = 'bg-destructive/5';
            else if (isToday) bgClass = 'bg-primary/5 ring-1 ring-inset ring-primary/20';

            return (
              <div
                key={cell.dateStr}
                className={`min-h-[80px] border-b border-r border-border flex flex-col ${bgClass}`}
              >
                <div className="px-2 pt-1.5 flex items-start justify-between gap-1">
                  <div className="flex items-baseline gap-1 min-w-0">
                    {cell.isAdjacentMonth ? (
                      <span className="text-xs font-medium text-muted-foreground">
                        {new Date(cell.dateStr + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                      </span>
                    ) : (
                      <span className={`text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}>
                        {cell.day}
                      </span>
                    )}
                    {shiftTypes.map(t => (
                      <span key={t} className="text-[9px] font-semibold text-muted-foreground">{t}</span>
                    ))}
                  </div>
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
                      <span title={statName} className="text-[9px] font-bold bg-destructive text-destructive-foreground px-1 py-0.5 rounded leading-none">
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
                    const premiums = settings ? calculateShiftPremiums(shift, settings) : null;
                    const isNight = premiums && premiums.night > 0;
                    const colors = getShiftColor(isNight);
                    const content = (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px]">{isNight ? '🌙' : '☀️'}</span>
                          <span className="opacity-70 font-mono">{shift.start_time}–{shift.end_time}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] opacity-80">
                          <span className="font-mono">{shift.paid_hours}h paid</span>
                          {shift.extended_shift && <span className="text-destructive font-medium">Ext</span>}
                          {shift.short_notice && <span className="font-medium">Notice</span>}
                        </div>
                        {(showHospitalAbbr && shift.hospital) || (showUnitAbbr && shift.unit) ? (
                          <div className="text-[8px] opacity-60 mt-0.5">
                            {[
                              showHospitalAbbr && shift.hospital ? (hospitals.find(h => h.name === shift.hospital)?.acronym || shift.hospital) : null,
                              showUnitAbbr && shift.unit ? (units.find(u => u.name === shift.unit)?.code || shift.unit) : null,
                            ].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                      </>
                    );
                    return readOnly ? (
                      <div key={si} className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] leading-tight border ${colors}`}>
                        {content}
                      </div>
                    ) : (
                      <button
                        key={si}
                        onClick={() => setEditingShift({ data: shift, periodId: shift.periodId, periodShiftIdx: shift.periodShiftIdx })}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] leading-tight border ${colors} hover:brightness-95 transition-all cursor-pointer`}
                      >
                        {content}
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
            <span className="text-[9px] font-bold bg-destructive text-destructive-foreground px-1 py-0.5 rounded">STAT</span> Stat Holiday / Super Stat
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${NIGHT_COLOR}`}>
            🌙 Night Shift
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${DAY_COLOR}`}>
            ☀️ Day Shift
          </span>
        </div>
      </div>
    </div>
  );
}