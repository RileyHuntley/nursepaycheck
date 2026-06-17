import { useState, useEffect, useCallback, useMemo } from 'react';
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

const HA_FULL_NAMES = {
  VCH:   'Vancouver Coastal Health',
  FH:    'Fraser Health',
  VIHA:  'Island Health',
  IH:    'Interior Health',
  NH:    'Northern Health',
  PHSA:  'Provincial Health Services Authority',
  PHC:   'Providence Health Care',
};

export default function ShiftCalendarGrid({ settings, shiftsMap, onShiftUpdate, onReload, showHeader = true }) {
  const [editingShift, setEditingShift] = useState(null);
  const [hospitalFilter, setHospitalFilter] = useState('all');
  const [haFilter, setHaFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
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

  // Derive filter options
  const allShifts = Object.values(shiftsMap).flat();
  const hospitals = settings?.hospitals || [];
  const units = settings?.units || [];

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
      </div>

      <EditShiftDialog
        editingShift={editingShift}
        settings={settings}
        onSubmit={handleUpdateShift}
        onClose={() => setEditingShift(null)}
      />

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs font-medium text-muted-foreground mr-1">Filters:</span>

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
                    const premiums = settings ? calculateShiftPremiums(shift, settings) : null;
                    const isNight = premiums && premiums.night > 0;
                    return (
                      <button
                        key={si}
                        onClick={() => setEditingShift({ data: shift, periodId: shift.periodId, periodShiftIdx: shift.periodShiftIdx })}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] leading-tight border ${colors} hover:brightness-95 transition-all cursor-pointer`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-[11px]">{isNight ? '🌙' : '☀️'}</span>
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