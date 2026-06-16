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
import { X, CalendarPlus } from 'lucide-react';
import { SHIFT_PATTERNS, generateShiftsFromPattern } from '@/lib/shiftPatterns';

export default function BulkAddShift({ onSubmit, onCancel, settings }) {
  const [startDate, setStartDate] = useState('');
  const [patternName, setPatternName] = useState(settings?.default_shift_pattern || 'DDNN');
  const [repetitions, setRepetitions] = useState(2);
  const [preview, setPreview] = useState(null);

  const pattern = SHIFT_PATTERNS.find(p => p.name === patternName) || SHIFT_PATTERNS[0];

  const updatePreview = (date, pat, reps) => {
    if (!date || !pat || !reps || reps < 1) {
      setPreview(null);
      return;
    }
    const shifts = generateShiftsFromPattern(date, pat, reps, {
      hospital: settings?.default_hospital || '',
      unit: settings?.default_unit || '',
    });
    setPreview(shifts);
  };

  const handleStartDateChange = (d) => {
    setStartDate(d);
    updatePreview(d, pattern, repetitions);
  };

  const handlePatternChange = (p) => {
    setPatternName(p);
    const pat = SHIFT_PATTERNS.find(pt => pt.name === p);
    updatePreview(startDate, pat, repetitions);
  };

  const handleRepsChange = (r) => {
    setRepetitions(r);
    updatePreview(startDate, pattern, r);
  };

  const handleSubmit = () => {
    if (!preview || preview.length === 0) return;
    onSubmit(preview);
  };

  const cycleDays = pattern ? pattern.sequence.length : 0;
  const totalDays = repetitions * cycleDays;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarPlus className="w-4 h-4 text-primary" />
          Bulk Add Shifts
        </h3>
        {onCancel && (
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">First Shift Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Shift Pattern</Label>
          <Select value={patternName} onValueChange={handlePatternChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIFT_PATTERNS.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name} — {p.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Repetitions</Label>
          <Input
            type="number"
            min="1"
            max="26"
            value={repetitions}
            onChange={(e) => handleRepsChange(parseInt(e.target.value) || 1)}
            className="h-9 text-sm w-24"
          />
        </div>
      </div>

      {pattern && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          <span className="font-medium text-foreground">{pattern.name}:</span> {pattern.description} · {cycleDays}-day cycle · {repetitions}× = {totalDays} calendar days, <span className="font-medium text-primary">{preview ? preview.length : pattern.sequence.filter(s => s !== null).length * repetitions}</span> shifts
        </div>
      )}

      {preview && preview.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Preview ({preview.length} shifts)
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border">
            {preview.map((shift, i) => (
              <div key={i} className="px-3 py-1.5 flex items-center gap-3 text-xs">
                <span className="font-medium text-foreground w-28 flex-shrink-0">
                  {new Date(shift.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', weekday: 'short' })}
                </span>
                <span className="text-muted-foreground font-mono flex-shrink-0">{shift.start_time}–{shift.end_time}</span>
                <span className="text-muted-foreground flex-shrink-0">{shift.paid_hours}h</span>
                {shift.hospital && (
                  <span className="text-muted-foreground truncate">{shift.hospital}{shift.unit ? ` — ${shift.unit}` : ''}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="bg-primary text-primary-foreground"
          onClick={handleSubmit}
          disabled={!preview || preview.length === 0}
        >
          <CalendarPlus className="w-4 h-4 mr-1.5" />
          Add {preview ? preview.length : 0} Shifts
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}