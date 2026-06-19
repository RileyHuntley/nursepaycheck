import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import { useBlocker } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, X, AlertTriangle, Info, Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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


const QUALIFICATION_OPTIONS = [
  { key: 'special_clinical_prep', label: 'Special Clinical Prep', rate: 50, article: 'Art. 53.01', desc: 'Nurse must have successfully completed a course and received a certificate or diploma from an accredited hospital, college, university, or institute. Only regular nurses qualify.' },
  { key: 'bsn', label: 'BSN Degree', rate: 100, article: 'Art. 53.05', desc: 'Applicable only to employees hired prior to the first pay period after April 1, 2016. Nurses who have successfully completed a bachelor\'s degree in nursing.' },
  { key: 'masters', label: "Master's Degree", rate: 125, article: 'Art. 53.06', desc: 'Nurses who complete a master\'s degree in nursing, psychology, or another approved area of study are eligible.' },
  { key: 'rpn_dual', label: 'RPN Dual Registration', rate: 50, article: 'Art. 53.03', desc: 'Nurses who acquire and maintain both registrations as a Registered Nurse and a Registered Psychiatric Nurse. Not required to be employed within Psychiatry.' },
  { key: 'cha_bcit', label: 'CHA / BCIT Certification', rate: 25, article: 'Art. 53.02', desc: 'Requires completion of: 1) CHA/CAN Nursing Unit Administration Course; 2) CHA Hospital Department Management Course; or 3) BCIT certificate in Health Care Management — and must be employed in a capacity to use the courses.' },
  { key: 'university_prep', label: 'University Preparation', rate: 25, article: 'Art. 53.04', desc: 'Applicable only to employees hired prior to the first pay period after April 1, 2016. Nurses who have passed an accredited one-year university course in nursing.' },
];

const PREMIUM_INFO = {
  evening: { article: 'Art. 28.01', title: 'Evening Shift Premium', desc: 'Paid for the entire shift when >½ of hours fall between 15:30–23:30. Extended-hour nurses: paid only for hours actually within 15:30–23:30.' },
  night: { article: 'Art. 28.01', title: 'Night Shift Premium', desc: 'Paid for the entire shift when >½ of hours fall between 23:30–07:30. Extended-hour nurses: paid only for hours actually within 23:30–07:30.' },
  weekend: { article: 'Art. 28.02', title: 'Weekend Premium', desc: 'Paid for each hour worked between 23:00 Friday and 23:00 Sunday. Does not apply to certain members under NBA Article 25.07(H) Flexible Work Schedules.' },
  super_shift: { article: 'Art. 28.03', title: 'Super Shift Premium', desc: 'Paid on all hours worked between: (a) 23:30 Friday – 07:30 Saturday; and (b) 23:30 Saturday – 07:30 Sunday. Targets the most difficult shifts to fill.' },
  regular_premium: { article: 'Art. 28.05', title: 'Regular Premium', desc: 'Paid on all straight-time hours worked by regular employees (excluding overtime) to incentivize nurses taking regular positions.' },
  short_notice: { article: 'Art. 28.04', title: 'Short Notice Premium', desc: 'Paid when called in within 24 hours prior to shift commencement, on all hours worked.' },
  responsibility_hourly: { article: 'Art. 30', title: 'Responsibility Pay (Hourly)', desc: 'Paid to nurses designated in-charge of a ward/unit for ≥2 hours. Normally Level 3 nurses. In-charge duties must be "over and above" normal duties. Cannot combine hourly + flat on same shift.' },
  responsibility_flat: { article: 'Art. 30', title: 'Responsibility Pay (Flat per Shift)', desc: 'Flat $18.75 per shift for nurses designated in-charge. Cannot combine hourly + flat on same shift.' },
  preceptor: { article: 'App. GG', title: 'Preceptor Premium', desc: 'Paid for the entire shift when designated as a preceptor supervising a Preceptee. The nurse must be designated by the Employer based on educational and regulatory requirements.' },
  specialty: { article: 'Art. 28.06', title: 'Specialty Premium (OR/PAR/ER/ICU/CCU)', desc: 'Paid on all hours worked by regular employees working in OR, PAR, ER, ICU, or CCU.' },
  on_call_first_72: { article: 'Art. 29.03(a)', title: 'On-Call (First 72 hrs/mo)', desc: 'Paid for all on-call hours within the first 72 hours designated on-call in a calendar month.' },
  on_call_beyond_72: { article: 'Art. 29.03(a)', title: 'On-Call (Beyond 72 hrs/mo)', desc: 'Paid for all on-call hours beyond 72 hours within the same calendar month.' },
};

const ALLOWANCE_INFO = {
  isolation: { article: 'Art. 54', title: 'Isolation Allowance', desc: 'Lump-sum of $150/month for nurses working in communities identified in Article 54. Pro-rated for Part-Time & Casual nurses. Paid in full on the first pay period of each month that a shift is worked.' },
  business: { article: 'Art. 57.06', title: 'Business Allowance', desc: 'Lump-sum of $150/month for all regular nurses employed in community-based services. Does not include clinic-type services aligned with acute care (e.g. hospital outpatient clinics).' },
};

const OT_TYPES = [
  {
    type: 'Regular Shift',
    multiplier: '×1.0',
    color: 'bg-chart-3/15 text-chart-3',
    description: 'Standard straight-time pay. Applied to regular, ISN, orientation, education, vacation, sick, PDO/PST, and other paid leaves.',
    article: 'NBA CBA',
  },
  {
    type: 'Overtime Shift',
    multiplier: '×1.5',
    color: 'bg-chart-2/15 text-chart-2',
    description: 'Paid at 1.5× for shifts beyond normal daily hours (as per Art. 26.01) or the length of the extended shift offered and accepted.',
    article: 'NBA CBA',
  },
  {
    type: 'Working Day Off',
    multiplier: '×2.0',
    color: 'bg-chart-5/15 text-chart-5',
    description: 'Paid at 2× for all hours worked on a regular full-time employee\'s scheduled day off.',
    article: 'NBA CBA',
  },
  {
    type: 'Work Stat Holiday',
    multiplier: '×2.0',
    color: 'bg-chart-5/15 text-chart-5',
    description: 'Paid at 2× for all hours worked on a statutory holiday (within 0001–2400 hours on that holiday).',
    article: 'NBA CBA',
  },
  {
    type: 'Work Super Stat',
    multiplier: '×2.5',
    color: 'bg-destructive/15 text-destructive',
    description: 'Paid at 2.5× for all hours worked on a Super Stat holiday. Super Stats are: Christmas Day, Labour Day, and Good Friday.',
    article: 'NBA CBA',
  },
  {
    type: 'OT Shift on Stat',
    multiplier: '×3.0',
    color: 'bg-destructive/15 text-destructive',
    description: 'Members receive overtime at 1.5× the appropriate holiday rate for all hours worked on a statutory holiday. Regular stat: 1.5× × 2× = 3×. Note: Super stat OT would be 1.5× × 2.5× = 3.75×.',
    article: 'NBA CBA',
  },
];
const defaultSettings = {
  nurse_profile: {
    license_type: '',
    license_status: '',
    bccnm_license: '',
    bccnm_expiry: '',
    employee_ids: {},
    anniversary_dates: {},
  },
  hourly_wage: 45.00,
  wage_history: [],
  ot_multipliers: { overtime: 1.5, overtime_extended: 2.0, stat_holiday: 1.5, ot_stat_holiday: 3.0 },
  premium_rates: {
    evening: 1.40, night: 5.00, weekend: 3.50, super_shift: 1.85, regular_premium: 2.15,
    short_notice: 2.00, responsibility_hourly: 2.50, responsibility_flat: 18.75,
    preceptor: 1.50, specialty: 2.00, on_call_first_72: 7.00, on_call_beyond_72: 7.50,
  },
  active_allowances: [],
  allowance_rates: { isolation: 150, business: 150 },
  active_qualifications: [],
  qualification_rates: {
    special_clinical_prep: 50, bsn: 100, masters: 125,
    rpn_dual: 50, cha_bcit: 25, university_prep: 25,
  },
  shift_lines: [{ status: 'full_time', fte: 1.0, hospital: '', unit: '' }],
  tax_settings: { annual_provincial_income: 0, annual_federal_income: 0 },
};

function InfoPopover({ infoKey, infoMap, onClose }) {
  const info = infoMap[infoKey];
  if (!info) return null;
  return (
    <div className="absolute z-50 left-0 bottom-full mb-2 w-72 bg-popover border border-border rounded-lg shadow-lg p-3 text-left" onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <p className="text-xs font-semibold text-foreground leading-tight">{info.title}</p>
          <p className="text-[10px] text-primary font-mono mt-0.5">{info.article}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{info.desc}</p>
    </div>
  );
}

export default function PayConfiguration() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [savedVersion, setSavedVersion] = useState(0);
  const [openInfo, setOpenInfo] = useState(null);
  const [newWageAmount, setNewWageAmount] = useState('');
  const [newWageDate, setNewWageDate] = useState('');
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
      const merged = {
        ...defaultSettings,
        ...list[0],
        nurse_profile: (() => {
          const np = { ...defaultSettings.nurse_profile, ...(list[0].nurse_profile || {}) };
          if (!np.employee_ids) np.employee_ids = {};
          if (!np.anniversary_dates) np.anniversary_dates = {};
          return np;
        })(),
        premium_rates: { ...defaultSettings.premium_rates, ...(list[0].premium_rates || {}) },
        ot_multipliers: { ...defaultSettings.ot_multipliers, ...(list[0].ot_multipliers || {}) },
        allowance_rates: { ...defaultSettings.allowance_rates, ...(list[0].allowance_rates || {}) },
        qualification_rates: { ...defaultSettings.qualification_rates, ...(list[0].qualification_rates || {}) },
        preset_times: { ...(defaultSettings.preset_times || {}), ...(list[0].preset_times || {}) },
        tax_settings: { ...defaultSettings.tax_settings, ...(list[0].tax_settings || {}) },
        shift_lines: list[0].shift_lines || defaultSettings.shift_lines,
        active_allowances: list[0].active_allowances || defaultSettings.active_allowances,
        active_qualifications: list[0].active_qualifications || defaultSettings.active_qualifications,
        wage_history: list[0].wage_history || [],
        hospitals: list[0].hospitals || [],
        units: list[0].units || [],
      };
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

  const toggleAllowance = (key) => {
    setSettings(s => {
      const current = s.active_allowances || [];
      const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
      return { ...s, active_allowances: next };
    });
  };

  const setShiftLine = (index, field, value) => {
    setSettings(s => {
      const lines = [...(s.shift_lines || [{ status: 'full_time', fte: 1.0, hospital: '', unit: '' }])];
      const updated = { ...lines[index], [field]: value };
      // Auto-set FTE when status changes
      if (field === 'status') {
        if (value === 'full_time') updated.fte = 1.0;
        else if (value === 'casual') updated.fte = 0.0;
        else if (value === 'part_time') updated.fte = undefined;
      }
      lines[index] = updated;
      return { ...s, shift_lines: lines };
    });
  };

  const addShiftLine = () => {
    setSettings(s => {
      const lines = [...(s.shift_lines || [{ status: 'full_time', fte: 1.0, hospital: '', unit: '' }])];
      if (lines.length >= 3) return s;
      return { ...s, shift_lines: [...lines, { status: 'full_time', fte: 1.0, hospital: '', unit: '' }] };
    });
  };

  const removeShiftLine = (index) => {
    setSettings(s => {
      const lines = [...(s.shift_lines || [{ status: 'full_time', fte: 1.0, hospital: '', unit: '' }])];
      return { ...s, shift_lines: lines.filter((_, i) => i !== index) };
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
    <div className="max-w-3xl space-y-8" onClick={() => setOpenInfo(null)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Pay Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">NBA CBA wage, premium rates, and allowances</p>
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
      {/* Nurse Profile */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Nurse Profile</h3>
          <p className="text-xs text-muted-foreground mt-1">Your license and employment details.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">License Type</Label>
            <Select
              value={settings.nurse_profile?.license_type || ''}
              onValueChange={v => set('nurse_profile.license_type', v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select license" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ESN">Employed Student Nurse (ESN)</SelectItem>
                <SelectItem value="LPN">Licensed Practical Nurse (LPN)</SelectItem>
                <SelectItem value="RN">Registered Nurse (RN)</SelectItem>
                <SelectItem value="NP">Nurse Practitioner (NP)</SelectItem>
                <SelectItem value="MW">Midwife (MW)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">License Status</Label>
            <Select
              value={settings.nurse_profile?.license_status || ''}
              onValueChange={v => set('nurse_profile.license_status', v)}
            >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_practising">Current Practising</SelectItem>
              <SelectItem value="non_practising">Non Practising</SelectItem>
              <SelectItem value="provisional_registration">Provisional Registration</SelectItem>
              <SelectItem value="former_licensee">Former Licensee</SelectItem>
            </SelectContent>
          </Select>
          </div>
          {(() => {
            const hospitals = settings.hospitals || [];
            const uniqueHAs = [...new Set(hospitals.map(h => h.health_authority).filter(Boolean))].slice(0, 4);
            if (uniqueHAs.length === 0) return null;
            return uniqueHAs.map(ha => (
              <div key={ha} className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{ha} Employee ID</Label>
                  <Input
                    type="text"
                    value={settings.nurse_profile?.employee_ids?.[ha] || ''}
                    onChange={e => setSettings(s => ({
                      ...s,
                      nurse_profile: {
                        ...s.nurse_profile,
                        employee_ids: { ...(s.nurse_profile?.employee_ids || {}), [ha]: e.target.value },
                      },
                    }))}
                    className="h-9 text-sm font-mono"
                    placeholder="e.g. 123456"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{ha} Anniversary Date</Label>
                  <Input
                    type="date"
                    value={settings.nurse_profile?.anniversary_dates?.[ha] || ''}
                    onChange={e => setSettings(s => ({
                      ...s,
                      nurse_profile: {
                        ...s.nurse_profile,
                        anniversary_dates: { ...(s.nurse_profile?.anniversary_dates || {}), [ha]: e.target.value },
                      },
                    }))}
                    className="h-9 text-sm font-mono"
                  />
                </div>
              </div>
            ));
          })()}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">BCCNM License Number</Label>
            <Input
              type="text"
              value={settings.nurse_profile?.bccnm_license || ''}
              onChange={e => set('nurse_profile.bccnm_license', e.target.value)}
              className="h-9 text-sm font-mono"
              placeholder="e.g. 1234567"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">BCCNM License Expiry</Label>
            <Input
              type="date"
              value={settings.nurse_profile?.bccnm_expiry || ''}
              onChange={e => set('nurse_profile.bccnm_expiry', e.target.value)}
              className="h-9 text-sm font-mono"
            />
          </div>
        </div>
      </section>
      {/* Wage History */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Wage &amp; Wage History</h3>
        {/* Existing entries */}
        {(settings.wage_history || []).length > 0 && (
          <div className="space-y-2">
            {[...(settings.wage_history || [])]
              .filter(e => e.wage > 0)
              .sort((a, b) => (b.effective_date || '') > (a.effective_date || '') ? 1 : -1)
              .reverse()
              .map((entry, idx, arr) => {
                const origIdx = (settings.wage_history || []).indexOf(entry);
                return (
                  <div key={origIdx} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-foreground w-28">
                      {entry.effective_date || 'No date'}
                    </span>
                    <span className="text-sm font-mono text-foreground">${entry.wage.toFixed(2)}/hr</span>
                    {idx === 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-chart-3/15 text-chart-3 border border-chart-3/20">Current</span>
                    )}
                    <button
                      onClick={() => setSettings(s => ({ ...s, wage_history: (s.wage_history || []).filter((_, i) => i !== origIdx) }))}
                      className="ml-auto text-muted-foreground hover:text-foreground"
                      aria-label="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
          </div>
        )}
        {/* Add new entry */}
        <div className="flex items-center gap-2 pt-1">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
            <Input
              type="number" step="0.01" min="0"
              placeholder="45.00"
              value={newWageAmount}
              onChange={e => setNewWageAmount(e.target.value)}
              className="h-9 w-28 text-sm font-mono pl-6"
            />
          </div>
          <Input
            type="date"
            value={newWageDate}
            onChange={e => setNewWageDate(e.target.value)}
            className="h-9 w-40 text-sm font-mono"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!newWageAmount || !newWageDate || parseFloat(newWageAmount) <= 0}
            onClick={() => {
              setSettings(s => ({
                ...s,
                wage_history: [...(s.wage_history || []), { effective_date: newWageDate, wage: parseFloat(newWageAmount) }],
              }));
              setNewWageAmount('');
              setNewWageDate('');
            }}
          >
            <Plus className="w-4 h-4 mr-1" />Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Historical shifts use the wage in effect on their date.</p>
      </section>

      {/* Employment Status & FTE */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Employment Status &amp; FTE</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add up to 3 shift lines if you work across multiple statuses, hospitals, or units. FTE is auto-set for Full Time (1.0) and Casual (0.0); enter your own for Part Time.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Regular Full-Time', badge: 'FT', color: 'bg-chart-3/15 text-chart-3 border-chart-3/20', desc: '37.5 hours/week · 1,950 hours/year · Includes paid statutory holidays, vacation, and other paid leaves.' },
            { label: 'Regular Part-Time', badge: 'PT', color: 'bg-chart-2/15 text-chart-2 border-chart-2/20', desc: 'Minimum 15 hours/week up to 1,950 hours/year · FTE calculated as a % of shifts vs. a full-time employee.' },
            { label: 'Casual', badge: 'CAS', color: 'bg-muted/60 text-muted-foreground border-border', desc: 'No fixed schedule · Relief capacity for sick calls, vacation, LOAs, workload, maternity, and banked OT coverage.' },
          ].map(({ label, badge, color, desc }) => (
            <div key={badge} className={`rounded-lg border px-3 py-2.5 ${color}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${color}`}>{badge}</span>
                <span className="text-xs font-semibold">{label}</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-80">{desc}</p>
            </div>
          ))}
        </div>
        {(settings.shift_lines || [{ status: 'full_time', fte: 1.0, hospital: '', unit: '' }]).map((line, idx) => {
          const isFteLocked = line.status === 'full_time' || line.status === 'casual';
          const canRemove = (settings.shift_lines || []).length > 1;
          const hospitals = settings.hospitals || [];
          const units = settings.units || [];
          return (
            <div key={idx} className="space-y-2 p-3 rounded-lg border border-border bg-muted/10">
              <div className="flex items-center gap-3">
                <Select
                  value={line.status}
                  onValueChange={(v) => setShiftLine(idx, 'status', v)}
                >
                  <SelectTrigger className="h-9 w-36 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
                <Label className="text-xs text-muted-foreground flex-shrink-0">FTE</Label>
                {isFteLocked ? (
                  <span className="h-9 w-20 flex items-center justify-center text-sm font-mono bg-muted/40 text-muted-foreground border border-muted-foreground/20 rounded-md">
                    {line.status === 'full_time' ? '1.0' : '0.0'}
                  </span>
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    placeholder="0.00"
                    value={line.fte ?? ''}
                    onChange={e => setShiftLine(idx, 'fte', e.target.value === '' ? undefined : (parseFloat(e.target.value) || 0))}
                    className="h-9 w-20 text-sm font-mono"
                  />
                )}
                {canRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeShiftLine(idx)}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive ml-auto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground mb-1 block">Hospital</Label>
                  <Select
                    value={line.hospital || ''}
                    onValueChange={(v) => setShiftLine(idx, 'hospital', v === '_none' ? '' : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select hospital" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— None —</SelectItem>
                      {hospitals.map(h => (
                        <SelectItem key={h.name} value={h.name}>{h.name} [{h.acronym}] · {h.health_authority}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground mb-1 block">Unit</Label>
                  <Select
                    value={line.unit || ''}
                    onValueChange={(v) => setShiftLine(idx, 'unit', v === '_none' ? '' : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— None —</SelectItem>
                      {units.map(u => (
                        <SelectItem key={u.name} value={u.name}>{u.name} [{u.code}]</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          );
        })}
        {(settings.shift_lines || []).length < 3 && (
          <Button type="button" variant="outline" size="sm" onClick={addShiftLine} className="text-xs">
            + Add another line
          </Button>
        )}
      </section>

      {/* Overtime Multipliers */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Overtime & Shift Multipliers</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Multipliers are set per-shift when logging time. The NBA CBA defines how each shift type is compensated based on when and why you are working beyond your regular schedule. Note: Overtime is currently configured for full time only.
          </p>
        </div>
        <div className="space-y-3">
          {OT_TYPES.map(({ type, multiplier, color, description, article }) => (
            <div key={type} className="flex gap-3 items-start p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
                  {multiplier}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">{article}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{type}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Overtime on Stats (Art. CON230)</p>
          <p>Regular stat OT: 1.5× × 2.0× = <strong>3.0×</strong></p>
          <p>Super stat OT: 1.5× × 2.5× = <strong>3.75×</strong></p>
          <p className="pt-1 font-semibold text-foreground">Consecutive Shift Overtime Triggers (Part-Time)</p>
          <p>&gt; 4 consecutive extended shifts (&gt;8h) → 2× for additional shifts</p>
          <p>&gt; 6 consecutive shifts (7.5–8h) → 2× for additional shifts</p>
          <p>&gt; 225 straight-time hours over 3 consecutive bi-weekly pay periods → 2×</p>
        </div>
      </section>

      {/* Premium Rates */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Hourly Premium Rates ($/hr)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            NBA CBA rates as of April 1, 2025. These rarely change — only update when a new CBA is ratified.
            Click <Info className="inline w-3 h-3" /> for a full description of each premium.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { key: 'evening', label: 'Evening Shift (15:30–23:30)' },
            { key: 'night', label: 'Night Shift (23:30–07:30)' },
            { key: 'weekend', label: 'Weekend (Fri 23:00–Sun 23:00)' },
            { key: 'super_shift', label: 'Super Shift (Fri/Sat overnight)' },
            { key: 'regular_premium', label: 'Regular Premium (straight time)' },
            { key: 'short_notice', label: 'Short Notice Call-In' },
            { key: 'responsibility_hourly', label: 'Responsibility Pay (hourly)' },
            { key: 'preceptor', label: 'Preceptor' },
            { key: 'specialty', label: 'Specialty (OR/PAR/ER/ICU/CCU)' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpenInfo(openInfo === key ? null : key); }}
                  className={`flex-shrink-0 p-0.5 rounded transition-colors ${openInfo === key ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <Label className="text-xs text-muted-foreground truncate">{label}</Label>
              </div>
              <div className="relative flex-shrink-0">
                {openInfo === key && (
                  <InfoPopover infoKey={key} infoMap={PREMIUM_INFO} onClose={() => setOpenInfo(null)} />
                )}
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50 font-mono">$</span>
                <Input
                  type="number" step="0.01" min="0"
                  value={settings.premium_rates?.[key] || 0}
                  onChange={e => set(`premium_rates.${key}`, parseFloat(e.target.value) || 0)}
                  className="h-9 w-24 text-sm font-mono pl-6 bg-muted/40 text-muted-foreground border-muted-foreground/20 hover:bg-muted/60 focus:bg-card focus:text-foreground transition-colors"
                />
              </div>
            </div>
          ))}
        </div>
        {/* Flat responsibility + on-call */}
        <div className="flex items-center gap-2 pt-1">
          <div className="flex items-center gap-1 flex-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenInfo(openInfo === 'responsibility_flat' ? null : 'responsibility_flat'); }}
              className={`flex-shrink-0 p-0.5 rounded transition-colors ${openInfo === 'responsibility_flat' ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'}`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            <Label className="text-xs text-muted-foreground">Responsibility Pay (flat per shift)</Label>
          </div>
          <div className="relative flex-shrink-0">
            {openInfo === 'responsibility_flat' && (
              <InfoPopover infoKey="responsibility_flat" infoMap={PREMIUM_INFO} onClose={() => setOpenInfo(null)} />
            )}
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50 font-mono">$</span>
            <Input
              type="number" step="0.01" min="0"
              value={settings.premium_rates?.responsibility_flat || 0}
              onChange={e => set('premium_rates.responsibility_flat', parseFloat(e.target.value) || 0)}
              className="h-9 w-24 text-sm font-mono pl-6 bg-muted/40 text-muted-foreground border-muted-foreground/20 hover:bg-muted/60 focus:bg-card focus:text-foreground transition-colors"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          {[
            { key: 'on_call_first_72', label: 'On-Call (first 72 hrs/mo)' },
            { key: 'on_call_beyond_72', label: 'On-Call (beyond 72 hrs/mo)' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpenInfo(openInfo === key ? null : key); }}
                  className={`flex-shrink-0 p-0.5 rounded transition-colors ${openInfo === key ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <Label className="text-xs text-muted-foreground truncate">{label}</Label>
              </div>
              <div className="relative flex-shrink-0">
                {openInfo === key && (
                  <InfoPopover infoKey={key} infoMap={PREMIUM_INFO} onClose={() => setOpenInfo(null)} />
                )}
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50 font-mono">$</span>
                <Input
                  type="number" step="0.01" min="0"
                  value={settings.premium_rates?.[key] || 0}
                  onChange={e => set(`premium_rates.${key}`, parseFloat(e.target.value) || 0)}
                  className="h-9 w-24 text-sm font-mono pl-6 bg-muted/40 text-muted-foreground border-muted-foreground/20 hover:bg-muted/60 focus:bg-card focus:text-foreground transition-colors"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Monthly Allowances */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4" onClick={() => setOpenInfo(null)}>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Monthly Allowances</h3>
          <p className="text-xs text-muted-foreground mt-1">Paid in full on the first pay period of each month that a shift is worked. Toggle on only allowances that apply to your position.</p>
        </div>
        {[
          { key: 'isolation', label: 'Isolation Allowance', rate: 150 },
          { key: 'business', label: 'Business Allowance', rate: 150 },
        ].map(({ key, label, rate }) => (
          <div key={key} className="flex items-center gap-4 relative">
            <Switch
              checked={(settings.active_allowances || []).includes(key)}
              onCheckedChange={() => toggleAllowance(key)}
            />
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <Label className="text-sm text-foreground">{label}</Label>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpenInfo(openInfo === `allow_${key}` ? null : `allow_${key}`); }}
                  className={`flex-shrink-0 p-0.5 rounded transition-colors ${openInfo === `allow_${key}` ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">${rate.toFixed(2)}/month — paid monthly</p>
            </div>
            {openInfo === `allow_${key}` && ALLOWANCE_INFO[key] && (
              <div className="absolute z-50 left-24 bottom-full mb-2 w-72 bg-popover border border-border rounded-lg shadow-lg p-3 text-left" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{ALLOWANCE_INFO[key].title}</p>
                    <p className="text-[10px] text-primary font-mono mt-0.5">{ALLOWANCE_INFO[key].article}</p>
                  </div>
                  <button onClick={() => setOpenInfo(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{ALLOWANCE_INFO[key].desc}</p>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Qualification Differentials */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4" onClick={() => setOpenInfo(null)}>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Qualification Differentials</h3>
          <p className="text-xs text-muted-foreground mt-1">
           Only regular nurses qualify — not casuals. Paid in full on the first pay period of each month that a shift is worked.
          </p>
        </div>
        {QUALIFICATION_OPTIONS.map(({ key, label, rate, article, desc }) => (
          <div key={key} className="flex items-start gap-4 relative">
            <Switch
              checked={(settings.active_qualifications || []).includes(key)}
              onCheckedChange={() => toggleQualification(key)}
              className="mt-0.5 flex-shrink-0"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <Label className="text-sm text-foreground">{label}</Label>
                <span className="text-[10px] text-primary font-mono">{article}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpenInfo(openInfo === `qual_${key}` ? null : `qual_${key}`); }}
                  className={`flex-shrink-0 p-0.5 rounded transition-colors ${openInfo === `qual_${key}` ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">${rate.toFixed(2)}/month — paid monthly</p>
            </div>
            {openInfo === `qual_${key}` && (
              <div className="absolute z-50 left-24 bottom-full mb-2 w-72 bg-popover border border-border rounded-lg shadow-lg p-3 text-left" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
                    <p className="text-[10px] text-primary font-mono mt-0.5">{article}</p>
                  </div>
                  <button onClick={() => setOpenInfo(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            )}
          </div>
        ))}
        <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground space-y-1 mt-2">
          <p className="font-semibold text-foreground">Additional Notes (Art. 53)</p>
          <p>• Eligible nurses may not qualify for more than one payment under Articles 53.02, 53.04, 53.05, and 53.06.</p>
          <p>• RN/RPN dual registrants do not need to be employed within Psychiatry.</p>
          <p>• Most employers combine multiple differentials into a single paystub line and pay monthly.</p>
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

      {/* Floating unsaved indicator */}
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
              You have unsaved changes to your pay configuration. If you leave now, your changes will be lost.
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