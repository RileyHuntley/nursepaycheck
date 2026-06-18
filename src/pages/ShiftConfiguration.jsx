import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import { useBlocker } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2, Plus, X, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SHIFT_PATTERNS } from '@/lib/shiftPatterns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const HEALTH_AUTHORITIES = [
  { value: 'VCH', label: 'Vancouver Coastal Health (VCH)' },
  { value: 'FH', label: 'Fraser Health (FH)' },
  { value: 'VIHA', label: 'Island Health (VIHA)' },
  { value: 'IH', label: 'Interior Health (IH)' },
  { value: 'NH', label: 'Northern Health (NH)' },
  { value: 'FNHA', label: 'First Nations Health Authority (FNHA)' },
  { value: 'PHSA', label: 'Provincial Health Services Authority (PHSA)' },
  { value: 'PHC', label: 'Providence Health Care (PHC)' },
  { value: 'NBA', label: 'Private Facility (NBA)' },
];

export default function ShiftConfiguration() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [savedVersion, setSavedVersion] = useState(0);
  const savedRef = useRef(null);

  const isDirty = useMemo(() => {
    if (!settings || !savedRef.current) return false;
    return !isEqual(settings, savedRef.current);
  }, [settings, savedVersion]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const loadSettings = useCallback(async () => {
    const list = await base44.entities.Settings.list();
    if (list.length > 0) {
      setSettings(list[0]);
      savedRef.current = cloneDeep(list[0]);
    } else {
      const created = await base44.entities.Settings.create({
        hospitals: [],
        units: [],
        default_hospital: '',
        default_unit: '',
        default_shift_pattern: 'DDNN',
        preset_times: {
          day_12h_start: '07:00', day_12h_end: '19:00',
          night_12h_start: '19:00', night_12h_end: '07:00',
          day_8h_start: '08:00', day_8h_end: '16:00',
        },
      });
      setSettings(created);
      savedRef.current = cloneDeep(created);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const set = (path, value) => {
    setSettings(s => {
      const copy = { ...s };
      const keys = path.split('.');
      let obj = copy;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]] = { ...obj[keys[i]] };
      obj[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  const [newHospitalName, setNewHospitalName] = useState('');
  const [newHospitalAcronym, setNewHospitalAcronym] = useState('');
  const [newHospitalHA, setNewHospitalHA] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitCode, setNewUnitCode] = useState('');

  const addHospital = () => {
    const name = newHospitalName.trim();
    const acronym = newHospitalAcronym.trim();
    const ha = newHospitalHA;
    if (!name || !acronym || !ha) return;
    if ((settings.hospitals || []).some(h => h.name === name)) return;
    setSettings(s => ({ ...s, hospitals: [...(s.hospitals || []), { name, acronym, health_authority: ha }] }));
    setNewHospitalName('');
    setNewHospitalAcronym('');
    setNewHospitalHA('');
  };

  const removeHospital = (name) => {
    setSettings(s => ({ ...s, hospitals: (s.hospitals || []).filter(h => h.name !== name), default_hospital: s.default_hospital === name ? '' : s.default_hospital }));
  };

  const addUnit = () => {
    const name = newUnitName.trim();
    const code = newUnitCode.trim();
    if (!name || !code) return;
    if ((settings.units || []).some(u => u.name === name)) return;
    setSettings(s => ({ ...s, units: [...(s.units || []), { name, code }] }));
    setNewUnitName('');
    setNewUnitCode('');
  };

  const removeUnit = (name) => {
    setSettings(s => ({ ...s, units: (s.units || []).filter(u => u.name !== name), default_unit: s.default_unit === name ? '' : s.default_unit }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await base44.entities.Settings.update(settings.id, settings);
      savedRef.current = cloneDeep(settings);
      setSavedVersion(v => v + 1);
      setMessage({ type: 'success', text: 'Configuration saved.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Shift Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">Hospitals, units, and shift defaults</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="bg-primary text-primary-foreground">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>

      {message && (
        <div className={`text-sm px-4 py-2 rounded-lg ${message.type === 'success' ? 'bg-chart-4/15 text-chart-4' : 'bg-destructive/15 text-destructive'}`}>
          {message.text}
        </div>
      )}

      {/* Hospitals & Units */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-foreground">Hospitals &amp; Units</h3>
        <p className="text-xs text-muted-foreground">Add the hospitals and units you work at.</p>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hospitals</h4>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-2">
            <Input value={newHospitalName} onChange={e => setNewHospitalName(e.target.value)} placeholder="Hospital name (e.g. Vancouver General)" className="h-9 text-sm" />
            <Input value={newHospitalAcronym} onChange={e => setNewHospitalAcronym(e.target.value)} placeholder="Abbreviation (e.g. VGH)" className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
            <Select value={newHospitalHA} onValueChange={v => setNewHospitalHA(v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Health authority" /></SelectTrigger>
              <SelectContent>{HEALTH_AUTHORITIES.map(ha => <SelectItem key={ha.value} value={ha.value}>{ha.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={addHospital} disabled={!newHospitalName.trim() || !newHospitalAcronym.trim() || !newHospitalHA} className="flex-shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          {(settings.hospitals || []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(settings.hospitals || []).map(h => (
                <span key={h.name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-xs font-medium text-foreground">
                  {h.name} <span className="text-[10px] text-muted-foreground">[{h.acronym}] · {h.health_authority}</span>
                  <button onClick={() => removeHospital(h.name)} className="ml-1 text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground italic">No hospitals added yet.</p>}
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Units</h4>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
            <Input value={newUnitName} onChange={e => setNewUnitName(e.target.value)} placeholder="Unit name (e.g. Medicine)" className="h-9 text-sm" />
            <Input value={newUnitCode} onChange={e => setNewUnitCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUnit())} placeholder="Unit # or Abbreviation (e.g. C2B)" className="h-9 text-sm" />
            <Button size="sm" variant="outline" onClick={addUnit} disabled={!newUnitName.trim() || !newUnitCode.trim()} className="flex-shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          {(settings.units || []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(settings.units || []).map(u => (
                <span key={u.name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-xs font-medium text-foreground">
                  {u.name} <span className="text-[10px] text-muted-foreground">[{u.code}]</span>
                  <button onClick={() => removeUnit(u.name)} className="ml-1 text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground italic">No units added yet.</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default Hospital</Label>
            <Select value={settings.default_hospital || ''} onValueChange={v => set('default_hospital', v === '_none' ? '' : v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {(settings.hospitals || []).map(h => <SelectItem key={h.name} value={h.name}>{h.name} [{h.acronym}] · {h.health_authority}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default Unit</Label>
            <Select value={settings.default_unit || ''} onValueChange={v => set('default_unit', v === '_none' ? '' : v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {(settings.units || []).map(u => <SelectItem key={u.name} value={u.name}>{u.name} [{u.code}]</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Shifts */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-foreground">Shifts</h3>
        <p className="text-xs text-muted-foreground">Set defaults to pre-fill new shifts.</p>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Default Shift Pattern</Label>
          <Select value={settings.default_shift_pattern || 'DDNN'} onValueChange={v => set('default_shift_pattern', v)}>
            <SelectTrigger className="h-9 text-sm max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIFT_PATTERNS.map(p => (
                <SelectItem key={p.name} value={p.name}>{p.name} — {p.description}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 pt-1">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Fill Preset Times</h4>
          <p className="text-xs text-muted-foreground">Customize the start/end times used by the Quick Fill buttons on shift forms.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: '12h Day Start', key: 'day_12h_start' },
              { label: '12h Day End', key: 'day_12h_end' },
              { label: '12h Night Start', key: 'night_12h_start' },
              { label: '12h Night End', key: 'night_12h_end' },
              { label: '8h Day Start', key: 'day_8h_start' },
              { label: '8h Day End', key: 'day_8h_end' },
            ].map(({ label, key }) => (
              <div key={key} className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</Label>
                <Input
                  type="text"
                  pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
                  placeholder="HH:MM"
                  value={settings.preset_times?.[key] || ''}
                  onChange={e => set(`preset_times.${key}`, e.target.value)}
                  className="h-9 w-[116px] text-sm font-mono"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {isDirty && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-card border border-chart-2/30 shadow-lg rounded-xl px-4 py-2.5 animate-in slide-in-from-right-4 duration-200">
          <span className="w-2 h-2 rounded-full bg-chart-2 animate-pulse flex-shrink-0" />
          <span className="text-sm font-medium text-chart-2">Unsaved changes</span>
        </div>
      )}

      <AlertDialog open={blocker.state === 'blocked'} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-chart-2" />
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your shift configuration. If you leave now, your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay on Page</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leave Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}