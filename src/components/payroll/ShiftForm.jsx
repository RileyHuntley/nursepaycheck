import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X } from 'lucide-react';

const SHIFT_TYPES = [
  { value: 'regular', label: 'Regular' },
  { value: 'overtime', label: 'Overtime' },
  { value: 'overtime_extended', label: 'Overtime (Extended)' },
  { value: 'stat_holiday', label: 'Stat Holiday' },
  { value: 'ot_stat_holiday', label: 'OT on Stat Holiday' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick' },
  { value: 'other_leave', label: 'Other Leave' },
];

const RESPONSIBILITY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'hourly', label: 'Hourly ($2.50/hr)' },
  { value: 'flat', label: 'Flat ($18.75/shift)' },
];

const emptyShift = {
  date: '',
  start_time: '',
  end_time: '',
  shift_type: 'regular',
  paid_hours: 7.5,
  unpaid_break: 0.5,
  paid_break: 0.25,
  short_notice: false,
  responsibility_pay: 'none',
  preceptor: false,
  on_call_hours: 0,
  notes: '',
};

export default function ShiftForm({ onSubmit, onCancel, initial }) {
  const [shift, setShift] = useState(initial || { ...emptyShift });

  const set = (field, value) => setShift((s) => ({ ...s, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!shift.date || !shift.start_time || !shift.end_time || !shift.paid_hours) return;
    onSubmit(shift);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {initial ? 'Edit Shift' : 'Add Shift'}
        </h3>
        {onCancel && (
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input type="date" value={shift.date} onChange={(e) => set('date', e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Start Time</Label>
          <Input type="time" value={shift.start_time} onChange={(e) => set('start_time', e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">End Time</Label>
          <Input type="time" value={shift.end_time} onChange={(e) => set('end_time', e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Shift Type</Label>
          <Select value={shift.shift_type} onValueChange={(v) => set('shift_type', v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIFT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Paid Hours</Label>
          <Input type="number" step="0.01" min="0" value={shift.paid_hours} onChange={(e) => set('paid_hours', parseFloat(e.target.value) || 0)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Unpaid Break (hrs)</Label>
          <Input type="number" step="0.25" min="0" value={shift.unpaid_break} onChange={(e) => set('unpaid_break', parseFloat(e.target.value) || 0)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Paid Break (hrs)</Label>
          <Input type="number" step="0.25" min="0" value={shift.paid_break} onChange={(e) => set('paid_break', parseFloat(e.target.value) || 0)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Responsibility Pay</Label>
          <Select value={shift.responsibility_pay} onValueChange={(v) => set('responsibility_pay', v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESPONSIBILITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch checked={shift.short_notice} onCheckedChange={(v) => set('short_notice', v)} />
          <Label className="text-xs text-muted-foreground cursor-pointer">Short Notice</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={shift.preceptor} onCheckedChange={(v) => set('preceptor', v)} />
          <Label className="text-xs text-muted-foreground cursor-pointer">Preceptor</Label>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground">On-Call Hours</Label>
          <Input type="number" step="0.5" min="0" value={shift.on_call_hours} onChange={(e) => set('on_call_hours', parseFloat(e.target.value) || 0)} className="h-9 w-20 text-sm" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
        <Input value={shift.notes} onChange={(e) => set('notes', e.target.value)} placeholder="e.g. covered Jane's shift" className="h-9 text-sm" />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" className="bg-primary text-primary-foreground hover:opacity-90">
          {initial ? 'Save Changes' : 'Add Shift'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}