import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

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
  const [shiftsMap, setShiftsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const periods = await base44.entities.PayPeriod.list('-start_date', 100);
      const map = {};
      for (const p of periods) {
        for (const s of (p.shifts || [])) {
          if (!s.date) continue;
          if (!map[s.date]) map[s.date] = [];
          map[s.date].push({ ...s, periodId: p.id, periodName: p.name });
        }
      }
      setShiftsMap(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  useEffect(() => {
    const unsub = base44.entities.PayPeriod.subscribe(() => loadShifts());
    return () => unsub();
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

  const monthLabel = viewDate.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

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
            const shifts = shiftsMap[cell.dateStr] || [];

            return (
              <div
                key={cell.dateStr}
                className={`min-h-[80px] border-b border-r border-border flex flex-col ${
                  isToday ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'bg-card'
                }`}
              >
                <div className={`px-2 pt-1.5 text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}>
                  {cell.day}
                </div>
                <div className="flex-1 px-1.5 pb-1.5 space-y-0.5">
                  {shifts.map((shift, si) => {
                    const colors = TYPE_COLORS[shift.shift_type] || TYPE_COLORS.regular;
                    return (
                      <Link
                        key={si}
                        to={`/pay-period?period=${shift.periodId}`}
                        className={`block px-1.5 py-0.5 rounded text-[10px] leading-tight border ${colors} hover:brightness-95 transition-all`}
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
                      </Link>
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
          {Object.keys(shiftsMap).length} shift days across all pay periods
        </p>
        <div className="flex items-center gap-3 flex-wrap">
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