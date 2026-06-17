import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Sun, Moon, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const TYPE_LABELS = {
  regular:         'Regular (×1.0)',
  day_off:         'Day Off (×2.0)',
  work_stat:       'Work Stat (×2.0)',
  work_super_stat: 'Super Stat (×2.5)',
  ot_stat:         'OT on Stat (×3.0)',
  overtime:        'Overtime (×1.5)',
  isn:             'ISN',
  vacation:        'Vacation',
  sick:            'Sick',
  pdo_pst:         'PDO/PST',
  other_leave:     'Leave',
};

const TYPE_COLORS = {
  regular:         'bg-chart-3/15 text-chart-3',
  day_off:         'bg-chart-2/15 text-chart-2',
  work_stat:       'bg-chart-5/15 text-chart-5',
  work_super_stat: 'bg-destructive/15 text-destructive',
  ot_stat:         'bg-destructive/15 text-destructive',
  overtime:        'bg-chart-2/15 text-chart-2',
  isn:             'bg-chart-3/15 text-chart-3',
  vacation:        'bg-chart-4/15 text-chart-4',
  sick:            'bg-chart-1/15 text-chart-1',
  pdo_pst:         'bg-muted text-muted-foreground',
  other_leave:     'bg-muted text-muted-foreground',
};

const TYPE_MULTIPLIERS = {
  regular:         1.0,
  day_off:         2.0,
  work_stat:       2.0,
  work_super_stat: 2.5,
  ot_stat:         3.0,
  overtime:        1.5,
  isn:             1.0,
  vacation:        1.0,
  sick:            1.0,
  pdo_pst:         1.0,
  other_leave:     1.0,
};

function PremiumChip({ label, amount, overridden }) {
  if (!amount || amount <= 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
      overridden ? 'bg-chart-2/20 text-chart-2 ring-1 ring-chart-2/40' : 'bg-primary/10 text-primary'
    }`}>
      {label} <span className="font-mono">{formatCurrency(amount)}</span>
      {overridden && <span className="opacity-60">*</span>}
    </span>
  );
}

const todayStr = new Date().toISOString().slice(0, 10);

function resolveStatus(shift) {
  // Verified is persisted; otherwise compute from date vs today
  if (shift.status === 'verified') return 'verified';
  if (!shift.date) return 'upcoming';
  if (shift.date > todayStr) return 'upcoming';
  return 'pending';
}

export default function ShiftRow({ shift, premiums, settings, periodEndDate, onEdit, onDelete, onVerify, readOnly, selectable, selected, onToggleSelect, hidePending }) {
  const overridden = premiums?._overridden || [];
  const hosp = shift.hospital ? (settings?.hospitals || []).find(h => h.name === shift.hospital) : null;
  const unit = shift.unit ? (settings?.units || []).find(u => u.name === shift.unit) : null;

  const wage = settings?.hourly_wage || 0;
  const multiplier = TYPE_MULTIPLIERS[shift.shift_type] || 1.0;
  const baseGross = shift.paid_hours * wage * multiplier;
  const premiumTotal = premiums
    ? (premiums.evening || 0) + (premiums.night || 0) + (premiums.weekend || 0) +
      (premiums.super_shift || 0) + (premiums.regular_premium || 0) +
      (premiums.specialty || 0) +
      (premiums.short_notice || 0) + (premiums.responsibility || 0) +
      (premiums.preceptor || 0)
    : 0;
  const totalGross = baseGross + premiumTotal;

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

        {wage > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] font-mono text-muted-foreground">
              {formatCurrency(baseGross)}
            </span>
            {premiumTotal > 0 && (
              <>
                <span className="text-[11px] text-muted-foreground">+</span>
                <span className="text-[11px] font-mono text-primary">
                  {formatCurrency(premiumTotal)}
                </span>
              </>
            )}
            <span className="text-[11px] text-muted-foreground">=</span>
            <span className="text-xs font-mono font-semibold text-foreground">
              {formatCurrency(totalGross)}
            </span>
          </div>
        )}

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
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(shift); }} className="h-7 w-7 text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Premium chips row */}
      {premiums && (
        <div className="flex flex-wrap gap-1.5 mt-1.5 ml-0">
          {shift.extended_shift && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive">Extended (full hrs)</span>
          )}
          <PremiumChip label="Evening" amount={premiums.evening} overridden={overridden.includes('evening')} />
          <PremiumChip label="Night" amount={premiums.night} overridden={overridden.includes('night')} />
          <PremiumChip label="Weekend" amount={premiums.weekend} overridden={overridden.includes('weekend')} />
          <PremiumChip label="Super Shift" amount={premiums.super_shift} overridden={overridden.includes('super_shift')} />
          <PremiumChip label="Regular" amount={premiums.regular_premium} overridden={overridden.includes('regular_premium')} />
          <PremiumChip label="Short Notice" amount={premiums.short_notice} overridden={overridden.includes('short_notice')} />
          <PremiumChip label="Resp. Pay" amount={premiums.responsibility} overridden={overridden.includes('responsibility')} />
          <PremiumChip label="Specialty" amount={premiums.specialty} overridden={overridden.includes('specialty')} />
          <PremiumChip label="Preceptor" amount={premiums.preceptor} overridden={overridden.includes('preceptor')} />
          {shift.on_call_hours > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-4/15 text-chart-4">
              On-Call {shift.on_call_hours}h
            </span>
          )}
        </div>
      )}

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