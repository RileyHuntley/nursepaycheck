import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

const TYPE_LABELS = {
  regular: 'Regular',
  overtime: 'OT (1.5x)',
  overtime_extended: 'OT Ext (2x)',
  stat_holiday: 'Stat Holiday',
  ot_stat_holiday: 'OT on Stat (3x)',
  vacation: 'Vacation',
  sick: 'Sick',
  other_leave: 'Leave',
};

const TYPE_COLORS = {
  regular: 'bg-chart-3/15 text-chart-3',
  overtime: 'bg-chart-2/15 text-chart-2',
  overtime_extended: 'bg-chart-2/15 text-chart-2',
  stat_holiday: 'bg-chart-5/15 text-chart-5',
  ot_stat_holiday: 'bg-chart-5/15 text-chart-5',
  vacation: 'bg-chart-4/15 text-chart-4',
  sick: 'bg-chart-1/15 text-chart-1',
  other_leave: 'bg-muted text-muted-foreground',
};

export default function ShiftRow({ shift, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors duration-150 group">
      <div className="w-28 flex-shrink-0">
        <span className="text-sm font-medium text-foreground">
          {new Date(shift.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', weekday: 'short' })}
        </span>
      </div>

      <div className="w-28 flex-shrink-0 text-sm text-foreground font-mono">
        {shift.start_time} – {shift.end_time}
      </div>

      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[shift.shift_type] || 'bg-muted text-muted-foreground'}`}>
        {TYPE_LABELS[shift.shift_type] || shift.shift_type}
      </span>

      <div className="w-20 flex-shrink-0 text-sm text-foreground font-mono text-right">
        {shift.paid_hours}h
      </div>

      <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
        {shift.short_notice && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-1/15 text-chart-1">Short Notice</span>
        )}
        {shift.responsibility_pay !== 'none' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-1/15 text-chart-1">
            Resp. Pay {shift.responsibility_pay === 'flat' ? '(Flat)' : '(Hrly)'}
          </span>
        )}
        {shift.preceptor && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-1/15 text-chart-1">Preceptor</span>
        )}
        {shift.on_call_hours > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-chart-4/15 text-chart-4">On-Call {shift.on_call_hours}h</span>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => onEdit(shift)} className="h-7 w-7">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(shift)} className="h-7 w-7 text-destructive hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}