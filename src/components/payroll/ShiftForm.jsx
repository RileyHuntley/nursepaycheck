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
import { calculateShiftPremiums, parseTime, splitOvernightShift, getSegmentMultiplier, formatTime } from '@/lib/premiumCalculator';
import { formatCurrency } from '@/lib/utils';

// Default settings used when none provided (for premium preview in form)
const DEFAULT_RATES = {
  premium_rates: {
    evening: 1.40, night: 5.00, weekend: 3.50, super_shift: 1.85,
    regular_premium: 2.15, short_notice: 2.00, responsibility_hourly: 2.50,
    responsibility_flat: 18.75, preceptor: 1.50,
    specialty: 2.00,
  },
};

// Shift types — stat/overtime multipliers are auto-calculated from date context
const SHIFT_TYPES = [
  { value: 'casual',          label: 'Casual Shift' },
  { value: 'regular',         label: 'Regular Shift' },
  { value: 'day_off',         label: 'Working Day Off' },
  { value: 'isn',             label: 'ISN Shift' },
  { value: 'vacation',        label: 'Paid Vacation' },
  { value: 'sick',            label: 'Paid Sick' },
  { value: 'unpaid_vacation', label: 'Unpaid Vacation' },
  { value: 'unpaid_sick',     label: 'Unpaid Sick' },
  { value: 'special_leave',   label: 'Special Leave' },
  { value: 'pdo_pst',         label: 'PDO / PST' },
  { value: 'other_leave',     label: 'Other Leave' },
];

const RESPONSIBILITY_OPTIONS = [
  { value: 'none',   label: 'None' },
  { value: 'hourly', label: 'Hourly ($2.50/hr)' },
  { value: 'flat',   label: 'Flat ($18.75/shift)' },
];

// Build presets from settings, falling back to defaults
const getPresets = (settings) => {
  const pt = settings?.preset_times || {};
  return [
    {
      label: '12h Day',
      values: { start_time: pt.day_12h_start || '07:00', end_time: pt.day_12h_end || '19:00', unpaid_break: 1, paid_break: 0.75 },
    },
    {
      label: '12h Night',
      values: { start_time: pt.night_12h_start || '19:00', end_time: pt.night_12h_end || '07:00', unpaid_break: 1, paid_break: 0.75 },
    },
    {
      label: '8h Day',
      values: { start_time: pt.day_8h_start || '08:00', end_time: pt.day_8h_end || '16:00', unpaid_break: 0.5, paid_break: 0 },
    },
  ];
};

const emptyShift = {
  date: '',
  start_time: '',
  end_time: '',
  shift_type: 'regular',
  unpaid_break: 1,
  paid_break: 0.75,
  hospital: '',
  unit: '',
  short_notice: false,
  responsibility_pay: 'none',
  preceptor: false,
  on_call_hours: 0,
  extended_shift: false,
  specialty_premium: false,
  notes: '',
};

export default function ShiftForm({ onSubmit, onCancel, onDelete, initial, settings }) {
  const [shift, setShift] = useState(() => {
    if (initial) return initial;
    return {
      ...emptyShift,
      hospital: settings?.default_hospital || '',
      unit: settings?.default_unit || '',
    };
  });
  const [showOverrides, setShowOverrides] = useState(false);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [showWageCalc, setShowWageCalc] = useState(false);

  // Compute total hours from start/end times, then paid hours = total − unpaid break
  const totalHours = (() => {
    if (!shift.start_time || !shift.end_time) return 0;
    const start = parseTime(shift.start_time);
    let end = parseTime(shift.end_time);
    if (end <= start) end += 24;
    return Math.round((end - start) * 100) / 100;
  })();
  const paidHours = Math.max(0, totalHours - (shift.unpaid_break || 0));

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
      // Stat/overtime multipliers are auto-calculated — type stays as selected
      return { ...s, date: dateStr, shift_type: newType };
    });
  };

  const applyPreset = (preset) => {
    setShift(s => ({ ...s, ...preset.values }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!shift.date || !shift.start_time || !shift.end_time || paidHours <= 0) return;
    onSubmit({ ...shift, paid_hours: paidHours });
  };

  // Show stat indicator if date is a stat
  const statType = shift.date ? getStatType(shift.date) : null;
  const statName = shift.date ? getStatName(shift.date) : null;

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {initial
            ? `Edit Shift — ${new Date(initial.date + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}`
            : 'Add Shift'}
        </h3>
        {onCancel && (
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Status Toggle + Preset Buttons */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={shift.status === 'verified'} onCheckedChange={(v) => set('status', v ? 'verified' : 'pending')} />
          <Label className="text-xs text-muted-foreground cursor-pointer">Verified</Label>
        </div>
        <span className="text-xs text-muted-foreground">· Quick fill:</span>
        {getPresets(settings).map((preset) => (
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

      {/* Overnight split indicator: shows how the shift splits across dates with different multipliers */}
      {shift.start_time && shift.end_time && shift.date && parseTime(shift.start_time) >= parseTime(shift.end_time) && (() => {
        const nextDate = new Date(shift.date + 'T12:00:00');
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().slice(0, 10);
        const nextStatType = getStatType(nextDateStr);
        const nextStatName = getStatName(nextDateStr);

        const STRAIGHT = ['casual', 'regular', 'isn', 'vacation', 'sick', 'special_leave', 'pdo_pst', 'other_leave'];

        // Only show if at least one day is a stat, or it's a day-off crossing a stat
        if (!statType && !nextStatType && shift.shift_type !== 'day_off') return null;

        let explanation = '';
        if (shift.shift_type === 'day_off') {
          if (statType && nextStatType) explanation = 'Day-off shift on a stat → all hours at 3×';
          else if (statType) explanation = `19:00–24:00 (${statName}) → 3× · 00:00–07:00 → 2× day-off rate`;
          else explanation = `19:00–24:00 → 2× day-off rate · 00:00–07:00 (${nextStatName}) → 3×`;
        } else if (STRAIGHT.includes(shift.shift_type)) {
          if (statType && nextStatType) explanation = `Both portions on stat holidays → ${statType === 'super_stat' ? '2.5×' : '2×'} all hours`;
          else if (statType) explanation = `19:00–24:00 (${statName}) → ${statType === 'super_stat' ? '2.5×' : '2×'} · 00:00–07:00 → 1×`;
          else explanation = `19:00–24:00 → 1× · 00:00–07:00 (${nextStatName}) → ${nextStatType === 'super_stat' ? '2.5×' : '2×'}`;
        } else if (shift.shift_type === 'unpaid_vacation' || shift.shift_type === 'unpaid_sick') {
          explanation = 'Unpaid — no earnings either portion';
        }

        return explanation ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <span>🌙 Overnight split:</span>
            <span>{explanation}</span>
          </div>
        ) : null;
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Total Hours</Label>
          <div className="h-9 flex items-center px-3 rounded-md border border-input bg-muted/30 text-sm font-mono text-foreground">
            {totalHours > 0 ? `${totalHours}h` : <span className="text-muted-foreground">—</span>}
          </div>
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
                <SelectItem key={h.name} value={h.name}>{h.name} [{h.acronym}] · {h.health_authority}</SelectItem>
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
                <SelectItem key={u.name} value={u.name}>{u.name} [{u.code}]</SelectItem>
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
          <Switch checked={shift.specialty_premium} onCheckedChange={(v) => set('specialty_premium', v)} />
          <Label className="text-xs text-muted-foreground cursor-pointer">Specialty Premium</Label>
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

      {/* Calculated Wage Breakdown */}
      {shift.start_time && shift.end_time && paidHours > 0 && shift.date && (() => {
        const wage = settings?.hourly_wage || DEFAULT_RATES.hourly_wage || 45;
        const shiftWithHours = { ...shift, paid_hours: paidHours };
        const segments = splitOvernightShift(shiftWithHours);
        const isOvernight = parseTime(shift.start_time) >= parseTime(shift.end_time);
        const hasBreak = (shift.unpaid_break || 0) > 0;
        const totalClock = isOvernight
          ? (24 - parseTime(shift.start_time)) + parseTime(shift.end_time)
          : parseTime(shift.end_time) - parseTime(shift.start_time);

        // Build break explanation for overnight shifts
        let breakNote = null;
        if (isOvernight && hasBreak && totalClock >= 5) {
          const breakStartH = parseTime(shift.start_time) + 5;
          const breakEndH = breakStartH + shift.unpaid_break;
          breakNote = `Unpaid break of ${shift.unpaid_break}h placed at the 5-hour mark: ${formatTime(breakStartH)}–${formatTime(breakEndH)}`;
        }

        const groups = {};
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const mult = getSegmentMultiplier(shift.shift_type, seg.date);
          const label = mult === 3.0 ? 'OT on Stat ×3'
            : mult === 2.5 ? 'Super Stat ×2.5'
            : mult === 2.0 ? (shift.shift_type === 'day_off' && !getStatType(seg.date) ? 'Day Off ×2' : 'Stat ×2')
            : mult === 1.0 ? 'Straight-Time Pay ×1'
            : null;
          if (label) {
            if (!groups[label]) groups[label] = { hours: 0, total: 0, ranges: [] };
            groups[label].hours += seg.hours;
            groups[label].total += seg.hours * wage * mult;
            groups[label].ranges.push(`${seg.hours.toFixed(2)}h (${seg.range || ''})`);
          }
        }

        // Aggregate calc string per group, including time ranges
        for (const key of Object.keys(groups)) {
          const g = groups[key];
          const multStr = key.match(/×([\d.]+)/)?.[1] || '1';
          const rangeStr = g.ranges.length === 1 ? ` ${g.ranges[0]}`
            : g.ranges.length > 1 ? ` ${g.ranges.join(' + ')}`
            : '';
          g.calc = `${g.hours.toFixed(2)}h × ${formatCurrency(wage)} × ${multStr} = ${formatCurrency(g.total)}${rangeStr}`;
        }

        const grandTotal = Object.values(groups).reduce((s, g) => s + g.total, 0);
        const DISPLAY_ORDER = ['Straight-Time Pay ×1', 'Day Off ×2', 'Stat ×2', 'Super Stat ×2.5', 'OT on Stat ×3'];

        return (
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowWageCalc(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Calculated Wage</span>
                {grandTotal > 0 && (
                  <span className="text-xs text-primary font-mono">
                    {formatCurrency(grandTotal).replace('$', '')} / {formatCurrency(wage)}/hr
                  </span>
                )}
              </div>
              {showWageCalc ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {showWageCalc && (
              <div className="px-4 py-3 space-y-2 bg-card">
                <p className="text-[11px] text-muted-foreground mb-2">Per-date segment breakdown — overnight shifts split at midnight for accurate stat/overtime rates.</p>
                {breakNote && (
                  <div className="text-[11px] text-muted-foreground font-mono bg-muted/30 px-2.5 py-1.5 rounded-md border border-border mb-1">
                    {breakNote}
                  </div>
                )}
                {DISPLAY_ORDER.map(label => {
                  const g = groups[label];
                  if (!g) return null;
                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div className="w-36 text-xs font-semibold text-foreground flex-shrink-0">{label}</div>
                        <div className="text-xs font-mono text-foreground">{g.calc}</div>
                      </div>
                      {g.ranges.length > 1 && g.ranges.map((rng, idx) => (
                        <div key={idx} className="text-[10px] text-muted-foreground font-mono pl-6 border-l-2 border-border ml-36">
                          {rng}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {Object.keys(groups).length === 0 && (
                  <div className="text-xs text-muted-foreground">No payable hours (unpaid type or zero multiplier).</div>
                )}
                {grandTotal > 0 && (
                  <div className="flex items-center gap-3 pt-1.5 mt-1 border-t border-border">
                    <div className="w-36 text-xs font-semibold text-foreground flex-shrink-0">Gross Wage Total</div>
                    <div className="text-xs font-mono font-semibold text-primary">{formatCurrency(grandTotal)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Premium Preview & Override */}
      {shift.start_time && shift.end_time && paidHours > 0 && (() => {
        const calcSettings = settings || DEFAULT_RATES;
        const shiftWithHours = { ...shift, paid_hours: paidHours };
        const premiums = calculateShiftPremiums(shiftWithHours, calcSettings);
        const overrides = shift.premium_overrides || {};
        const PREMIUM_FIELDS = [
          { key: 'evening',         label: 'Evening Premium',     hoursKey: 'evening_hours' },
          { key: 'night',           label: 'Night Premium',       hoursKey: 'night_hours' },
          { key: 'weekend',         label: 'Weekend Premium',     hoursKey: 'weekend_hours' },
          { key: 'super_shift',     label: 'Super Shift Premium', hoursKey: 'super_shift_hours' },
          { key: 'regular_premium', label: 'Regular Premium',     hoursKey: 'regular_premium_hours' },
          { key: 'short_notice',    label: 'Short Notice',        hoursKey: 'short_notice_hours' },
          { key: 'responsibility',  label: 'Responsibility Pay',  hoursKey: 'responsibility_hours' },
          { key: 'preceptor',       label: 'Preceptor',           hoursKey: 'preceptor_hours' },
          { key: 'specialty',       label: 'Specialty Premium',   hoursKey: 'specialty_hours' },
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
                    {formatCurrency(PREMIUM_FIELDS.reduce((s, f) => s + (premiums[f.key] || 0), 0)).replace('$', '')}
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
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-muted-foreground">Auto-calculated values shown. Enter an override to replace a value on this shift only. Clear to restore auto-calculation.</p>
                  <button
                    type="button"
                    onClick={() => setOverrideEnabled(v => !v)}
                    className={`text-[10px] px-2 py-0.5 rounded border font-medium transition-colors ${overrideEnabled ? 'bg-chart-2/15 text-chart-2 border-chart-2/30' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}
                  >
                    {overrideEnabled ? 'overriding' : 'override premiums'}
                  </button>
                </div>
                {PREMIUM_FIELDS.map(({ key, label, hoursKey }) => {
                  const calcVal = premiums[key] || 0;
                  const calcHours = premiums[hoursKey] || 0;
                  const isOverridden = overrides[key] != null;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-36 text-xs text-muted-foreground flex-shrink-0">{label}</div>
                      <div className="text-xs font-mono text-foreground flex-shrink-0" style={{ width: '8.5rem' }}>
                        {calcVal > 0 ? `${formatCurrency(calcVal)} (${calcHours.toFixed(2)} hrs)` : formatCurrency(calcVal)}
                      </div>
                      {overrideEnabled && (
                        <>
                          <span className="text-xs text-muted-foreground flex-shrink-0">→</span>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="override"
                              value={isOverridden ? overrides[key] : ''}
                              onChange={e => setOverride(key, e.target.value)}
                              className={`h-7 w-32 text-xs font-mono pl-5 ${isOverridden ? 'border-chart-2 ring-1 ring-chart-2/30' : ''}`}
                            />
                          </div>
                          {isOverridden && (
                            <button type="button" onClick={() => clearOverride(key)} className="text-[10px] text-muted-foreground hover:text-destructive">clear</button>
                          )}
                        </>
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
        {initial && onDelete && (
          <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(initial)} className="ml-auto">
            Delete Shift
          </Button>
        )}
      </div>
    </form>
  );
}