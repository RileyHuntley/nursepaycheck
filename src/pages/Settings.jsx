import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, Plus, X } from 'lucide-react';
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

const QUALIFICATION_OPTIONS = [
  { key: 'special_clinical_prep', label: 'Special Clinical Prep', rate: 50 },
  { key: 'bsn', label: 'BSN Degree', rate: 100 },
  { key: 'masters', label: "Master's Degree", rate: 125 },
  { key: 'rpn_dual', label: 'RPN Dual Registration', rate: 50 },
  { key: 'cha_bcit', label: 'CHA / BCIT Certification', rate: 25 },
  { key: 'university_prep', label: 'University Preparation', rate: 25 },
];

const defaultSettings = {
  hourly_wage: 45.00,
  ot_multipliers: { overtime: 1.5, overtime_extended: 2.0, stat_holiday: 1.5, ot_stat_holiday: 3.0 },
  premium_rates: {
    evening: 1.40, night: 5.00, weekend: 3.50, super_shift: 1.85, regular_premium: 2.15,
    short_notice: 2.00, responsibility_hourly: 2.50, responsibility_flat: 18.75,
    preceptor: 1.50, on_call_first_72: 7.00, on_call_beyond_72: 7.50,
  },
  active_allowances: ['isolation'],
  allowance_rates: { isolation: 150, business: 150 },
  active_qualifications: [],
  qualification_rates: {
    special_clinical_prep: 50, bsn: 100, masters: 125,
    rpn_dual: 50, cha_bcit: 25, university_prep: 25,
  },
  hospitals: [],
  units: [],
  default_hospital: '',
  default_unit: '',
  default_shift_pattern: 'DDNN',
};

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const loadSettings = useCallback(async () => {
    const list = await base44.entities.Settings.list();
    if (list.length > 0) {
      setSettings(list[0]);
    } else {
      const created = await base44.entities.Settings.create(defaultSettings);
      setSettings(created);
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

  const toggleAllowance = (key) => {
    setSettings(s => {
      const current = s.active_allowances || [];
      const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
      return { ...s, active_allowances: next };
    });
  };

  const toggleQualification = (key) => {
    setSettings(s => {
      const current = s.active_qualifications || [];
      const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
      return { ...s, active_qualifications: next };
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
      setMessage({ type: 'success', text: 'Settings saved.' });
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
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure wage, premiums, and allowances per your CBA</p>
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

      {/* Hourly Wage */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Base Hourly Wage</h3>
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground w-40">Hourly Rate ($)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={settings.hourly_wage}
            onChange={e => set('hourly_wage', parseFloat(e.target.value) || 0)}
            className="h-9 w-32 text-sm font-mono"
          />
        </div>
        <p className="text-xs text-muted-foreground">Update annually when your CBA wage scale changes.</p>
      </section>

      {/* OT Multipliers info */}
      <section className="bg-muted/50 border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Overtime Multipliers</h3>
        <p className="text-xs text-muted-foreground">Multipliers are set per-shift when logging time, per the NBA CBA: Regular ×1.0 · Overtime ×1.5 · Working Day Off ×2.0 · Work Stat ×2.0 · Work Super Stat ×2.5 · OT on Stat ×3.0. Super stats are Good Friday, Labour Day, and Christmas Day.</p>
      </section>

      {/* Premium Rates */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Hourly Premium Rates ($/hr)</h3>
        <p className="text-xs text-muted-foreground">Auto-applied rates. Update when CBA rates change annually.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { key: 'evening', label: 'Evening Shift (15:30–23:30)', defaultVal: 1.40 },
            { key: 'night', label: 'Night Shift (23:30–07:30)', defaultVal: 5.00 },
            { key: 'weekend', label: 'Weekend (Fri 23:00–Sun 23:00)', defaultVal: 3.50 },
            { key: 'super_shift', label: 'Super Shift (Fri/Sat overnight)', defaultVal: 1.85 },
            { key: 'regular_premium', label: 'Regular Premium (straight time)', defaultVal: 2.15 },
            { key: 'short_notice', label: 'Short Notice Call-In', defaultVal: 2.00 },
            { key: 'responsibility_hourly', label: 'Responsibility Pay (hourly)', defaultVal: 2.50 },
            { key: 'preceptor', label: 'Preceptor', defaultVal: 1.50 },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground flex-1 min-w-0 truncate">{label}</Label>
              <Input
                type="number" step="0.01" min="0"
                value={settings.premium_rates?.[key] || 0}
                onChange={e => set(`premium_rates.${key}`, parseFloat(e.target.value) || 0)}
                className="h-9 w-24 text-sm font-mono flex-shrink-0"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Label className="text-xs text-muted-foreground flex-1">Responsibility Pay (flat per shift)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={settings.premium_rates?.responsibility_flat || 0}
            onChange={e => set('premium_rates.responsibility_flat', parseFloat(e.target.value) || 0)}
            className="h-9 w-24 text-sm font-mono flex-shrink-0"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          {[
            { key: 'on_call_first_72', label: 'On-Call (first 72 hrs/mo)', defaultVal: 7.00 },
            { key: 'on_call_beyond_72', label: 'On-Call (beyond 72 hrs/mo)', defaultVal: 7.50 },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground flex-1">{label}</Label>
              <Input
                type="number" step="0.01" min="0"
                value={settings.premium_rates?.[key] || 0}
                onChange={e => set(`premium_rates.${key}`, parseFloat(e.target.value) || 0)}
                className="h-9 w-24 text-sm font-mono flex-shrink-0"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Monthly Allowances */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Monthly Allowances</h3>
        <p className="text-xs text-muted-foreground">Prorated per bi-weekly pay period: monthly ÷ (26/12)</p>
        {[
          { key: 'isolation', label: 'Isolation Allowance', rate: 150 },
          { key: 'business', label: 'Business Allowance', rate: 150 },
        ].map(({ key, label, rate }) => (
          <div key={key} className="flex items-center gap-4">
            <Switch
              checked={(settings.active_allowances || []).includes(key)}
              onCheckedChange={() => toggleAllowance(key)}
            />
            <div className="flex-1">
              <Label className="text-sm text-foreground">{label}</Label>
              <p className="text-xs text-muted-foreground">${rate.toFixed(2)}/month = ${(rate * 12 / 26).toFixed(2)}/period</p>
            </div>
          </div>
        ))}
      </section>

      {/* Qualification Differentials */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Qualification Differentials</h3>
        <p className="text-xs text-muted-foreground">Hourly rate = (annual total ÷ 1950 hrs). Applied to regular straight-time hours.</p>
        {QUALIFICATION_OPTIONS.map(({ key, label, rate }) => (
          <div key={key} className="flex items-center gap-4">
            <Switch
              checked={(settings.active_qualifications || []).includes(key)}
              onCheckedChange={() => toggleQualification(key)}
            />
            <div className="flex-1">
              <Label className="text-sm text-foreground">{label}</Label>
              <p className="text-xs text-muted-foreground">${rate.toFixed(2)}/month → ${((rate * 12) / 1950).toFixed(3)}/hr</p>
            </div>
          </div>
        ))}
      </section>

      {/* Hospitals & Units */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-foreground">Hospitals & Units</h3>
        <p className="text-xs text-muted-foreground">Add the hospitals and units you work at. Set defaults to pre-fill new shifts.</p>

        {/* Hospitals */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hospitals</h4>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-2">
            <Input
              value={newHospitalName}
              onChange={e => setNewHospitalName(e.target.value)}
              placeholder="Hospital name (e.g. Vancouver General)"
              className="h-9 text-sm"
            />
            <Input
              value={newHospitalAcronym}
              onChange={e => setNewHospitalAcronym(e.target.value)}
              placeholder="Abbreviation (e.g. VGH)"
              className="h-9 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
            <Select value={newHospitalHA} onValueChange={v => setNewHospitalHA(v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Health authority" />
              </SelectTrigger>
              <SelectContent>
                {HEALTH_AUTHORITIES.map(ha => (
                  <SelectItem key={ha.value} value={ha.value}>{ha.label}</SelectItem>
                ))}
              </SelectContent>
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
                  <button onClick={() => removeHospital(h.name)} className="ml-1 text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No hospitals added yet.</p>
          )}
        </div>

        {/* Units */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Units</h4>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              value={newUnitName}
              onChange={e => setNewUnitName(e.target.value)}
              placeholder="Unit name (e.g. Medicine)"
              className="h-9 text-sm"
            />
            <Input
              value={newUnitCode}
              onChange={e => setNewUnitCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUnit())}
              placeholder="Unit # or Abbreviation (e.g. C2B)"
              className="h-9 text-sm"
            />
            <Button size="sm" variant="outline" onClick={addUnit} disabled={!newUnitName.trim() || !newUnitCode.trim()} className="flex-shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          {(settings.units || []).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(settings.units || []).map(u => (
                <span key={u.name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-xs font-medium text-foreground">
                  {u.name} <span className="text-[10px] text-muted-foreground">[{u.code}]</span>
                  <button onClick={() => removeUnit(u.name)} className="ml-1 text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No units added yet.</p>
          )}
        </div>

        {/* Defaults */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default Shift Pattern</Label>
            <Select value={settings.default_shift_pattern || 'DDNN'} onValueChange={v => set('default_shift_pattern', v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_PATTERNS.map(p => (
                  <SelectItem key={p.name} value={p.name}>{p.name} — {p.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Default Hospital / Unit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default Hospital</Label>
            <Select value={settings.default_hospital || ''} onValueChange={v => set('default_hospital', v === '_none' ? '' : v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {(settings.hospitals || []).map(h => (
                  <SelectItem key={h.name} value={h.name}>{h.name} [{h.acronym}] · {h.health_authority}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default Unit</Label>
            <Select value={settings.default_unit || ''} onValueChange={v => set('default_unit', v === '_none' ? '' : v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— None —</SelectItem>
                {(settings.units || []).map(u => (
                  <SelectItem key={u.name} value={u.name}>{u.name} [{u.code}]</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
    </div>
  );
}