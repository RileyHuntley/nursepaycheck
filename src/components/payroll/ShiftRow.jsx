import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Sun, Moon, Check, Copy } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { splitOvernightShift, getSegmentMultiplier, getWageForDate } from '@/lib/premiumCalculator';

const TYPE_LABELS = {
  casual:          'Casual',
  regular:         'Regular',
  day_off:         'Day Off',
  isn:             'ISN',
  vacation:        'Paid Vacation',
  sick:            'Paid Sick',
  unpaid_vacation: 'Unpaid Vacation',
  unpaid_sick:     'Unpaid Sick',
  special_leave:   'Special Leave',
  pdo_pst:         'PDO/PST',
  other_leave:     'Other Leave',
  orientation:     'Orientation',
  education:          'Education',
  student_practicum:  'Student Practicum',
};

const TYPE_COLORS = {
  casual:          'bg-chart-3/15 text-chart-3',
  regular:         'bg-chart-3/15 text-chart-3',
  day_off:         'bg-chart-2/15 text-chart-2',
  isn:             'bg-chart-3/15 text-chart-3',
  vacation:        'bg-chart-4/15 text-chart-4',
  sick:            'bg-chart-1/15 text-chart-1',
  unpaid_vacation: 'bg-muted text-muted-foreground',
  unpaid_sick:     'bg-muted text-muted-foreground',
  special_leave:   'bg-chart-5/15 text-chart-5',
  pdo_pst:         'bg-muted text-muted-foreground',
  other_leave:     'bg-muted text-muted-foreground',
  orientation:     'bg-chart-3/15 text-chart-3',
  education:          'bg-chart-3/15 text-chart-3',
  student_practicum:  'bg-muted text-muted-foreground',
};

const todayStr = new Date().toISOString().slice(0, 10);

function resolveStatus(shift) {
  // Verified is persisted; otherwise compute from date vs today
  if (shift.status === 'verified') return 'verified';
  if (!shift.date) return 'upcoming';
  if (shift.date > todayStr) return 'upcoming';
  return 'pending';
}

export default function ShiftRow({ shift, premiums, settings, periodEndDate, onEdit, onDelete, onVerify, onDuplicate, readOnly, selectable, selected, onToggleSelect, hidePending }) {
  const hosp = shift.hospital ? (settings?.hospitals || []).find(h => h.name === shift.hospital) : null;
  const unit = shift.unit ? (settings?.units || []).find(u => u.name === shift.unit) : null;

  const wage = settings ? getWageForDate(settings, shift.date) : 0;
  const premiumTotal = premiums
    ? (premiums.evening || 0) + (premiums.night || 0) + (premiums.weekend || 0) +
      (premiums.super_shift || 0) + (premiums.regular_premium || 0) +
      (premiums.specialty || 0) +
      (premiums.short_notice || 0) + (premiums.responsibility || 0) +
      (premiums.preceptor || 0)
    : 0;

  // Detect night shift: use calculated premiums when available, otherwise fall back to start time
  const isNight = premiums
    ? (premiums.night || 0) > 0
    : shift.start_time >= '18:00' || shift.end_time <= '08:00';

  const effStatus = resolveStatus(shift);
  const periodEnded = periodEndDate && todayStr > periodEndDate;
  const showVerify = effStatus === 'pending' && periodEnded;

  const handleRowClick = () => {
    if (selectable && onToggleSelect) {
      onToggleSelect(shift);
    } else if (onEdit) {
      onEdit(shift);
    }
  };

  return (
    <div
      className={`px-4 py-3 bg-card hover:bg-muted/20 transition-colors duration-150 cursor-pointer ${selected ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : ''}`}
      onClick={handleRowClick}
    >
      {/* Top row: date, time, type, hours, status, actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {selectable && (
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={selected || false} onCheckedChange={() => onToggleSelect && onToggleSelect(shift)} />
          </div>
        )}
        <div className="flex items-center gap-1.5 flex-shrink-0" style={{ minWidth: '8rem' }}>
          {isNight
            ? <Moon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            : <Sun className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          }
          <span className="text-sm font-medium text-foreground">
            {new Date(shift.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', weekday: 'short' })}
          </span>
        </div>

        <div className="w-28 flex-shrink-0 text-sm text-foreground font-mono">
          {shift.start_time} – {shift.end_time}
        </div>

        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${TYPE_COLORS[shift.shift_type] || 'bg-muted text-muted-foreground'}`}>
          {TYPE_LABELS[shift.shift_type] || shift.shift_type}
        </span>

        {(shift.hospital || shift.unit) && (
          <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0">
            {hosp?.acronym && <span className="text-foreground font-semibold">{hosp.acronym}</span>}
            {shift.hospital && !hosp?.acronym && <span>{shift.hospital}</span>}
            {shift.unit && (unit?.code ? (
              <span> · <span className="text-foreground font-medium">{unit.code}</span></span>
            ) : (
              <span> · {shift.unit}</span>
            ))}
          </span>
        )}

        <div className="text-sm text-foreground font-mono flex-shrink-0">
          {shift.paid_hours}h
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          {effStatus === 'verified' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-chart-4/15 text-chart-4">
              <Check className="w-3 h-3" /> Verified
            </span>
          )}
          {effStatus === 'upcoming' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-chart-2/15 text-chart-2">
              Upcoming
            </span>
          )}
          {effStatus === 'pending' && !hidePending && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-destructive/15 text-destructive">
              Pending
            </span>
          )}
        </div>

        <div className="flex-1" />



        {!readOnly && !selectable && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {showVerify && onVerify && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onVerify(shift); }}
                className="h-7 w-7 text-chart-4 hover:text-chart-4 hover:bg-chart-4/10"
                title="Mark as verified"
              >
                <Check className="w-4 h-4" />
              </Button>
            )}
            {onDuplicate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onDuplicate(shift); }}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Duplicate shift"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(shift); }} className="h-7 w-7 text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Wage summary row */}
      {premiums && wage > 0 && (() => {
        const segments = splitOvernightShift(shift);
        let straightTime = 0;
        const otGroups = {};
        for (const seg of segments) {
          const mult = getSegmentMultiplier(shift.shift_type, seg.date);
          if (mult > 0) {
            const base = seg.hours * wage;
            straightTime += base;
            if (mult > 1) {
              const premium = seg.hours * wage * (mult - 1);
              if (!otGroups[mult]) otGroups[mult] = 0;
              otGroups[mult] += premium;
            }
          }
        }
        const otTotal = Object.values(otGroups).reduce((s, v) => s + v, 0);
        const grandTotal = straightTime + otTotal + premiumTotal;
        const otMults = Object.keys(otGroups).map(Number).sort((a, b) => a - b);
        return (
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-mono text-muted-foreground">
            {straightTime > 0 && (
              <span className="text-foreground font-medium">{formatCurrency(straightTime)}</span>
            )}
            {otMults.map((mult, i) => (
              <span key={mult}>
                {(straightTime > 0 || i > 0) && <span> + </span>}
                <span>OT×{mult}</span>
                <span className="text-foreground font-medium"> {formatCurrency(otGroups[mult])}</span>
              </span>
            ))}
            {((straightTime > 0 || otTotal > 0) && premiumTotal > 0) && <span> + </span>}
            {premiumTotal > 0 && (
              <><span>Premiums</span> <span className="text-foreground font-medium">{formatCurrency(premiumTotal)}</span></>
            )}
            {(straightTime > 0 || otTotal > 0 || premiumTotal > 0) && <span> = </span>}
            <span className="text-primary font-semibold">{formatCurrency(grandTotal)}</span>
          </div>
        );
      })()}

      {/* Misc flags when no premiums yet */}
      {!premiums && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {shift.extended_shift && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive">Extended</span>}
          {shift.short_notice && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-1/15 text-chart-1">Short Notice</span>}
          {shift.responsibility_pay !== 'none' && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-1/15 text-chart-1">Resp. Pay {shift.responsibility_pay === 'flat' ? '(Flat)' : '(Hrly)'}</span>}
          {shift.specialty_premium && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-1/15 text-chart-1">Specialty Premium</span>}
          {shift.preceptor && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-1/15 text-chart-1">Preceptor</span>}
          {shift.on_call_hours > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-4/15 text-chart-4">On-Call {shift.on_call_hours}h</span>}
        </div>
      )}
    </div>
  );
}