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
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { getStatType, getStatName } from '@/lib/statHolidays';
import { calculateShiftPremiums } from '@/lib/premiumCalculator';

// Default settings used when none provided (for premium preview in form)
const DEFAULT_RATES = {
  premium_rates: {
    evening: 1.40, night: 5.00, weekend: 3.50, super_shift: 1.85,
    regular_premium: 2.15, short_notice: 2.00, responsibility_hourly: 2.50,
    responsibility_flat: 18.75, preceptor: 1.50,
  },
};

// Shift types per NBA CBA screenshot
const SHIFT_TYPES = [
  { value: 'regular',        label: 'Regular Shift (×1.0)' },
  { value: 'day_off',        label: 'Working Day Off (×2.0)' },
  { value: 'work_stat',      label: 'Work Stat Holiday (×2.0)' },
  { value: 'work_super_stat',label: 'Work Super Stat (×2.5)' },
  { value: 'ot_stat',        label: 'OT Shift on Stat (×3.0)' },
  { value: 'overtime',       label: 'Overtime Shift (×1.5)' },
  { value: 'isn',            label: 'ISN Shift' },
  { value: 'vacation',       label: 'Paid Vacation' },
  { value: 'sick',           label: 'Paid Sick' },
  { value: 'pdo_pst',        label: 'PDO / PST' },
  { value: 'other_leave',    label: 'Other Leave' },
];

const RESPONSIBILITY_OPTIONS = [
  { value: 'none',   label: 'None' },
  { value: 'hourly', label: 'Hourly ($2.50/hr)' },
  { value: 'flat',   label: 'Flat ($18.75/shift)' },
];

// Preset templates
const PRESETS = [
  {
    label: '12h Day',
    values: { start_time: '07:00', end_time: '19:00', paid_hours: 11, unpaid_break: 1, paid_break: 0.75 },
  },
  {
    label: '12h Night',
    values: { start_time: '19:00', end_time: '07:00', paid_hours: 11, unpaid_break: 1, paid_break: 0.75 },
  },
  {
    label: '8h Day',
    values: { start_time: '08:00', end_time: '16:00', paid_hours: 7.5, unpaid_break: 0.5, paid_break: 0 },
  },
];

const emptyShift = {
  date: '',
  start_time: '',
  end_time: '',
  shift_type: 'regular',
  paid_hours: 11,
  unpaid_break: 1,
  paid_break: 0.75,
  hospital: '',
  unit: '',
  short_notice: false,
  responsibility_pay: 'none',
  preceptor: false,
  on_call_hours: 0,
  extended_shift: false,
  notes: '',
};

export default function ShiftForm({ onSubmit, onCancel, initial, settings }) {
  const [shift, setShift] = useState(() => {
    if (initial) return initial;
    return {
      ...emptyShift,
      hospital: settings?.default_hospital || '',
      unit: settings?.default_unit || '',
    };
  });
  const [showOverrides, setShowOverrides] = useState(false);

  const set = (field, value) => setShift((s) => ({ ...s, [field]: value }));
  const setOverride = (field, value) => setShift(s => ({
    ...s,
    premium_overrides: { ...(s.premium_overrides || {}), [field]: value === '' ? null : parseFloat(value) || 0 },
  }));
  const clearOverride = (field) => setShift(s => {
    const ov = { ...(s.premium_overrides || {}) };
    delete ov[field];
    return { ...s, premium_overrides: ov };
  });

  // When date changes, auto-suggest shift type if it's a stat
  const handleDateChange = (dateStr) => {
    setShift(s => {
      const statType = getStatType(dateStr);
      let newType = s.shift_type;
      // Only auto-suggest if still on 'regular' — don't override manual choices
      if (s.shift_type === 'regular' && statType === 'super_stat') newType = 'work_super_stat';
      else if (s.shift_type === 'regular' && statType === 'stat') newType = 'work_stat';
      return { ...s, date: dateStr, shift_type: newType };
    });
  };

  const applyPreset = (preset) => {
    setShift(s => ({ ...s, ...preset.values }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!shift.date || !shift.start_time || !shift.end_time || !shift.paid_hours) return;
    onSubmit(shift);
  };

  // Show stat indicator if date is a stat
  const statType = shift.date ? getStatType(shift.date) : null;
  const statName = shift.date ? getStatName(shift.date) : null;

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

      {/* Preset Buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Quick fill:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            className="px-3 py-1 text-xs rounded-md border border-border bg-muted hover:bg-accent hover:text-accent-foreground transition-colors font-medium"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Stat holiday indicator */}
      {statType && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
          statType === 'super_stat'
            ? 'bg-destructive/10 text-destructive border border-destructive/20'
            : 'bg-chart-2/10 text-chart-2 border border-chart-2/20'
        }`}>
          <span>{statType === 'super_stat' ? '⭐ Super Stat:' : '📅 Stat Holiday:'}</span>
          <span>{statName}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input type="date" value={shift.date} onChange={(e) => handleDateChange(e.target.value)} className="h-9 text-sm" />
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
          <Input type="number" step="0.25" min="0" value={shift.paid_hours} onChange={(e) => set('paid_hours', parseFloat(e.target.value) || 0)} className="h-9 text-sm" />
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

      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Hospital</Label>
          <Select value={shift.hospital || ''} onValueChange={(v) => set('hospital', v === '_none' ? '' : v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select hospital" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— None —</SelectItem>
              {(settings?.hospitals || []).map(h => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Unit</Label>
          <Select value={shift.unit || ''} onValueChange={(v) => set('unit', v === '_none' ? '' : v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— None —</SelectItem>
              {(settings?.units || []).map(u => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
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
        <div className="flex items-center gap-2">
          <Switch checked={shift.extended_shift} onCheckedChange={(v) => set('extended_shift', v)} />
          <Label className="text-xs text-muted-foreground cursor-pointer">Extended Shift</Label>
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

      {/* Premium Preview & Override */}
      {shift.start_time && shift.end_time && shift.paid_hours > 0 && (() => {
        const calcSettings = settings || DEFAULT_RATES;
        const premiums = calculateShiftPremiums(shift, calcSettings);
        const overrides = shift.premium_overrides || {};
        const PREMIUM_FIELDS = [
          { key: 'evening',         label: 'Evening Premium' },
          { key: 'night',           label: 'Night Premium' },
          { key: 'weekend',         label: 'Weekend Premium' },
          { key: 'super_shift',     label: 'Super Shift Premium' },
          { key: 'regular_premium', label: 'Regular Premium' },
          { key: 'short_notice',    label: 'Short Notice' },
          { key: 'responsibility',  label: 'Responsibility Pay' },
          { key: 'preceptor',       label: 'Preceptor' },
        ];
        const hasAnyPremium = PREMIUM_FIELDS.some(f => premiums[f.key] > 0);
        return (
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOverrides(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Calculated Premiums</span>
                {hasAnyPremium && (
                  <span className="text-xs text-primary font-mono">
                    ${PREMIUM_FIELDS.reduce((s, f) => s + (premiums[f.key] || 0), 0).toFixed(2)}
                  </span>
                )}
                {!hasAnyPremium && <span className="text-xs text-muted-foreground">None applicable</span>}
                {Object.keys(overrides).some(k => overrides[k] != null) && (
                  <span className="text-[10px] bg-chart-2/20 text-chart-2 px-1.5 py-0.5 rounded font-medium">overridden</span>
                )}
              </div>
              {showOverrides ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {showOverrides && (
              <div className="px-4 py-3 space-y-2 bg-card">
                <p className="text-[11px] text-muted-foreground mb-3">Auto-calculated values shown. Enter an override to replace a value on this shift only. Clear to restore auto-calculation.</p>
                {PREMIUM_FIELDS.map(({ key, label }) => {
                  const calcVal = premiums[key] || 0;
                  const isOverridden = overrides[key] != null;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-36 text-xs text-muted-foreground flex-shrink-0">{label}</div>
                      <div className="text-xs font-mono text-foreground w-14 text-right flex-shrink-0">
                        ${calcVal.toFixed(2)}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">→</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="override"
                        value={isOverridden ? overrides[key] : ''}
                        onChange={e => setOverride(key, e.target.value)}
                        className={`h-7 w-24 text-xs font-mono ${isOverridden ? 'border-chart-2 ring-1 ring-chart-2/30' : ''}`}
                      />
                      {isOverridden && (
                        <button type="button" onClick={() => clearOverride(key)} className="text-[10px] text-muted-foreground hover:text-destructive">clear</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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