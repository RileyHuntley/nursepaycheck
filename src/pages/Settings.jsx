import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2 } from 'lucide-react';

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

      {/* OT Multipliers */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Overtime Multipliers</h3>
        {[
          { key: 'overtime', label: 'Regular Overtime' },
          { key: 'overtime_extended', label: 'Extended Overtime' },
          { key: 'stat_holiday', label: 'Stat Holiday' },
          { key: 'ot_stat_holiday', label: 'OT on Stat Holiday' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground w-40">{label} (×)</Label>
            <Input
              type="number" step="0.1" min="1"
              value={settings.ot_multipliers?.[key] || 1}
              onChange={e => set(`ot_multipliers.${key}`, parseFloat(e.target.value) || 1)}
              className="h-9 w-24 text-sm font-mono"
            />
          </div>
        ))}
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
    </div>
  );
}