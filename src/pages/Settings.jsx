import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import { useBlocker, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2, Plus, X, AlertTriangle, Link2, Copy, RefreshCw } from 'lucide-react';
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

const defaultSettings = {
  hourly_wage: 45.00,
  ot_multipliers: { overtime: 1.5, overtime_extended: 2.0, stat_holiday: 1.5, ot_stat_holiday: 3.0 },
  premium_rates: {
    evening: 1.40, night: 5.00, weekend: 3.50, super_shift: 1.85, regular_premium: 2.15,
    short_notice: 2.00, responsibility_hourly: 2.50, responsibility_flat: 18.75,
    preceptor: 1.50, specialty: 2.00, on_call_first_72: 7.00, on_call_beyond_72: 7.50,
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
  preset_times: {
    day_12h_start: '07:00', day_12h_end: '19:00',
    night_12h_start: '19:00', night_12h_end: '07:00',
    day_8h_start: '08:00', day_8h_end: '16:00',
  },
};

export default function Settings() {
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
      const merged = { ...defaultSettings, ...list[0] };
      setSettings(merged);
      savedRef.current = cloneDeep(merged);
    } else {
      const created = await base44.entities.Settings.create(defaultSettings);
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

  const [shareCopied, setShareCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

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
      setMessage({ type: 'success', text: 'Settings saved.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  const syncShareLink = async (token, userId, settingsData, payPeriodsData) => {
    const existing = await base44.entities.ShareLink.filter({ token });
    if (existing.length > 0) {
      await base44.entities.ShareLink.update(existing[0].id, { settings_data: settingsData, pay_periods_data: payPeriodsData });
    } else {
      await base44.entities.ShareLink.create({ token, user_id: userId, settings_data: settingsData, pay_periods_data: payPeriodsData });
    }
  };

  const saveShareToken = async (token) => {
    await base44.entities.Settings.update(settings.id, { share_token: token || '' });
    const updated = { ...settings, share_token: token || '' };
    savedRef.current = cloneDeep(updated);
    setSettings(updated);
    setSavedVersion(v => v + 1);
    if (token) {
      const safeSettings = {
        hourly_wage: settings.hourly_wage, premium_rates: settings.premium_rates,
        ot_multipliers: settings.ot_multipliers, active_allowances: settings.active_allowances,
        allowance_rates: settings.allowance_rates, active_qualifications: settings.active_qualifications,
        qualification_rates: settings.qualification_rates, hospitals: settings.hospitals,
        units: settings.units, preset_times: settings.preset_times, tax_settings: settings.tax_settings,
      };
      const payPeriods = await base44.entities.PayPeriod.list('-start_date', 50);
      const withShifts = payPeriods.filter(p => p.shifts && p.shifts.length > 0);
      await syncShareLink(token, settings.created_by_id, safeSettings, withShifts);
    } else {
      const existing = await base44.entities.ShareLink.filter({ token: settings.share_token });
      if (existing.length > 0) await base44.entities.ShareLink.delete(existing[0].id);
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
          <p className="text-sm text-muted-foreground mt-1">Shift defaults, hospitals, tax estimation, and sharing</p>
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

      {/* Pay Configuration link notice */}
      <section className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Wage, Premiums & Allowances</h3>
        <p className="text-xs text-muted-foreground">
          Base hourly wage, overtime multipliers, hourly premium rates, monthly allowances, and qualification differentials are now in{' '}
          <Link to="/pay-configuration" className="text-primary underline font-medium">Pay Configuration</Link>.
        </p>
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

      {/* Tax Estimation */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Tax Estimation</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Enter your estimated annual taxable income to see marginal tax estimates on pay breakdowns.
            Leave at $0 to disable. These are estimates only — consult a tax professional for exact figures.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">BC Provincial — Est. Annual Taxable Income</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
              <Input
                type="text"
                value={(settings.tax_settings?.annual_provincial_income || 0).toLocaleString('en-CA')}
                onChange={e => set('tax_settings.annual_provincial_income', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                className="h-9 text-sm font-mono pl-6"
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Federal — Est. Annual Taxable Income</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
              <Input
                type="text"
                value={(settings.tax_settings?.annual_federal_income || 0).toLocaleString('en-CA')}
                onChange={e => set('tax_settings.annual_federal_income', parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                className="h-9 text-sm font-mono pl-6"
                placeholder="0"
              />
            </div>
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">2026 BC Provincial Marginal Rates</p>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>$0 – $50,363: 5.60%</p>
            <p>$50,364 – $100,728: 7.70%</p>
            <p>$100,729 – $115,648: 10.50%</p>
            <p>$115,649 – $140,430: 12.29%</p>
            <p>$140,431 – $190,405: 14.70%</p>
            <p>$190,406 – $265,545: 16.80%</p>
            <p>Over $265,545: 20.50%</p>
          </div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-2">2026 Federal Marginal Rates</p>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>$0 – $58,523: 14.00%</p>
            <p>$58,524 – $117,045: 20.50%</p>
            <p>$117,046 – $181,440: 26.00%</p>
            <p>$181,441 – $258,482: 29.00%</p>
            <p>Over $258,482: 33.00%</p>
          </div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-2">2026 Statutory Deductions</p>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>CPP: 5.95% on $3,500 – $74,600 (max $4,230.45/yr) · Overtime is not pensionable</p>
            <p>CPP2: 4.0% on $74,600 – $85,000 (max $416.00/yr)</p>
            <p>EI: 1.63% up to $68,900 (max $1,123.07/yr)</p>
          </div>
        </div>
      </section>

      {/* Share Link */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Share Link</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Generate a unique link to let anyone view your shift calendar and pay period summaries — no login required.
          </p>
        </div>
        {settings.share_token ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
              <code className="text-xs font-mono text-foreground flex-1 break-all select-all">
                {`${window.location.origin}/share?token=${settings.share_token}`}
              </code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share?token=${settings.share_token}`); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }} className="h-8 flex-shrink-0">
                <Copy className="w-3.5 h-3.5 mr-1" />
                {shareCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={async () => { setGenerating(true); const newToken = crypto.randomUUID(); await saveShareToken(newToken); setGenerating(false); }} disabled={generating} className="text-xs">
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generating ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
              <Button size="sm" variant="ghost" onClick={async () => { await saveShareToken(''); }} className="text-xs text-destructive hover:text-destructive">
                <X className="w-3.5 h-3.5 mr-1" />
                Revoke Link
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Regenerating invalidates the old link. Revoking stops all anonymous access.</p>
          </div>
        ) : (
          <Button size="sm" onClick={async () => { setGenerating(true); const newToken = crypto.randomUUID(); await saveShareToken(newToken); setGenerating(false); }} disabled={generating} className="bg-primary text-primary-foreground">
            <Link2 className="w-4 h-4 mr-2" />
            {generating ? 'Generating...' : 'Generate Share Link'}
          </Button>
        )}
      </section>

      {/* Hospitals & Units */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-foreground">Hospitals & Units</h3>
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
              You have unsaved changes to your settings. If you leave now, your changes will be lost.
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