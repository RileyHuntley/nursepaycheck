import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Landmark, History } from 'lucide-react';
import { calculateSickLeaveEntitlement, sickLeaveBreakdown, SICK_MAX_DAYS } from '@/lib/sickLeaveCalculator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EditShiftDialog from '@/components/payroll/EditShiftDialog';
import { calculatePeriodBreakdown } from '@/lib/premiumCalculator';

const HOURS_PER_DAY = 7.5;

const CATEGORIES = [
  {
    key: 'vacation',
    label: 'Paid Vacation',
    entitlementKey: 'vacation_entitlement',
    types: ['vacation', 'unpaid_vacation'],
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50 dark:bg-blue-950',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  {
    key: 'sick',
    label: 'Paid Sick Leave',
    entitlementKey: 'sick_entitlement',
    types: ['sick', 'unpaid_sick'],
    color: 'bg-amber-500',
    lightColor: 'bg-amber-50 dark:bg-amber-950',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  {
    key: 'special_leave',
    label: 'Special Leave',
    entitlementKey: 'special_leave_entitlement',
    types: ['special_leave'],
    color: 'bg-purple-500',
    lightColor: 'bg-purple-50 dark:bg-purple-950',
    textColor: 'text-purple-700 dark:text-purple-300',
  },
  {
    key: 'pdo_pst',
    label: 'PDO / PST',
    entitlementKey: 'pdo_pst_entitlement',
    types: ['pdo_pst'],
    color: 'bg-emerald-500',
    lightColor: 'bg-emerald-50 dark:bg-emerald-950',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    key: 'other_leave',
    label: 'Other Leave',
    entitlementKey: null,
    types: ['other_leave'],
    color: 'bg-slate-400',
    lightColor: 'bg-slate-50 dark:bg-slate-900',
    textColor: 'text-slate-600 dark:text-slate-400',
  },
];

function fmt(days) {
  return Number.isInteger(days) ? String(days) : days.toFixed(1);
}

function ShiftLogDialog({ open, onClose, title, shifts, showDays, onEditShift }) {
  const sorted = [...shifts].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title} — Shift Log</DialogTitle>
        </DialogHeader>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No shifts recorded.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium">Hours</th>
                  {showDays && <th className="text-right px-3 py-2 font-medium">Days</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => (
                  <tr
                    key={i}
                    className="border-t border-border cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => onEditShift(s)}
                    title="Click to edit shift"
                  >
                    <td className="px-3 py-2 font-mono">{s.date}</td>
                    <td className="px-3 py-2 text-muted-foreground capitalize">{s.shift_type.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-right font-mono">{s.paid_hours}h</td>
                    {showDays && <td className="px-3 py-2 text-right font-mono">{fmt(s.paid_hours / HOURS_PER_DAY)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const STATUS_LABELS = { full_time: 'Full Time', part_time: 'Part Time', casual: 'Casual' };

function CategoryCard({ category, shifts, entitlement, sickInfo, onEditShift }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const usedHours = shifts.reduce((sum, s) => sum + (s.paid_hours || 0), 0);
  const usedDays = usedHours / HOURS_PER_DAY;
  const hasLimit = entitlement > 0;
  const remaining = hasLimit ? Math.max(0, entitlement - usedDays) : null;
  const overLimit = hasLimit && usedDays > entitlement;
  const pct = hasLimit ? Math.min(100, (usedDays / entitlement) * 100) : 0;

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{category.label}</h3>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${category.lightColor} ${category.textColor}`}>
              {fmt(usedDays)} {usedDays === 1 ? 'day' : 'days'} used
            </span>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="View shift log"
            >
              <History className="w-3.5 h-3.5" />
              <span>Log</span>
            </button>
          </div>
        </div>

        {hasLimit && (
          <>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${overLimit ? 'bg-destructive' : category.color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{fmt(usedDays)} of {fmt(entitlement)} days used</span>
              <span className={overLimit ? 'text-destructive font-medium' : ''}>
                {overLimit ? `${fmt(usedDays - entitlement)} days over` : `${fmt(remaining)} days remaining`}
              </span>
            </div>
          </>
        )}

        {!hasLimit && !sickInfo && (
          <p className="text-xs text-muted-foreground">No annual limit set — configure in Pay Configuration.</p>
        )}

        {!hasLimit && sickInfo && (
          <p className="text-xs text-muted-foreground">No employment type configured — set shift lines in Pay Configuration.</p>
        )}

        {sickInfo && entitlement > 0 && (
          <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Entitlement basis — Art. 42 (1.5 days/month)</p>
            {sickInfo.map((line, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {STATUS_LABELS[line.status] ?? line.status}
                  {line.status === 'part_time' && line.fte != null ? ` (FTE ${line.fte.toFixed(2)})` : ''}
                  {line.status === 'casual' ? ' — not eligible' : ''}
                </span>
                {line.status !== 'casual' && (
                  <span className="font-mono">{fmt(line.days)} days/yr</span>
                )}
              </div>
            ))}
            {sickInfo.length > 1 && (
              <div className="flex items-center justify-between text-[11px] font-medium text-foreground border-t border-border pt-1 mt-1">
                <span>Total</span>
                <span className="font-mono">{fmt(entitlement)} days/yr</span>
              </div>
            )}
          </div>
        )}

        {shifts.length === 0 && (
          <p className="text-xs text-muted-foreground">No {category.label.toLowerCase()} shifts recorded this year.</p>
        )}
      </div>

      <ShiftLogDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={category.label}
        shifts={shifts}
        showDays
        onEditShift={(s) => { setDialogOpen(false); onEditShift(s); }}
      />
    </>
  );
}

// ESN hour limit counts ALL shift types except unpaid ones and day_off
const ESN_EXCLUDED_TYPES = ['day_off', 'unpaid_vacation', 'unpaid_sick'];

function EsnCard({ shifts, entitlement, onEditShift }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const usedHours = shifts.reduce((sum, s) => sum + (s.paid_hours || 0), 0);
  const remaining = Math.max(0, entitlement - usedHours);
  const overLimit = usedHours > entitlement;
  const pct = entitlement > 0 ? Math.min(100, (usedHours / entitlement) * 100) : 0;

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">ESN Hours</h3>
            <p className="text-xs text-muted-foreground">Employed Student Nurse clinical hours</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
              {fmt(usedHours)}h used
            </span>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="View shift log"
            >
              <History className="w-3.5 h-3.5" />
              <span>Log</span>
            </button>
          </div>
        </div>

        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${overLimit ? 'bg-destructive' : 'bg-rose-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{fmt(usedHours)} of {fmt(entitlement)} hours used</span>
          <span className={overLimit ? 'text-destructive font-medium' : ''}>
            {overLimit ? `${fmt(usedHours - entitlement)}h over limit` : `${fmt(remaining)}h remaining`}
          </span>
        </div>

        {shifts.length === 0 && (
          <p className="text-xs text-muted-foreground">No worked shifts recorded this year.</p>
        )}
      </div>

      <ShiftLogDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="ESN Hours"
        shifts={shifts}
        showDays={false}
        onEditShift={(s) => { setDialogOpen(false); onEditShift(s); }}
      />
    </>
  );
}

export default function TimeBank() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [periodMap, setPeriodMap] = useState({});
  const [settings, setSettings] = useState(null);
  const [timeBank, setTimeBank] = useState({});
  const [licenseType, setLicenseType] = useState('');
  const [shiftLines, setShiftLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingShift, setEditingShift] = useState(null); // { data, _periodId, _shiftIdx }
  const debounce = useRef(null);

  useEffect(() => {
    load();
    const unsub1 = base44.entities.PayPeriod.subscribe(() => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(load, 1000);
    });
    const unsub2 = base44.entities.Settings.subscribe(() => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(load, 1000);
    });
    return () => { unsub1(); unsub2(); if (debounce.current) clearTimeout(debounce.current); };
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [periodsData, settingsList] = await Promise.all([
        base44.entities.PayPeriod.list(),
        base44.entities.Settings.list(),
      ]);
      const map = {};
      periodsData.forEach(p => { map[p.id] = p; });
      setPeriodMap(map);
      const s = settingsList[0] || null;
      setSettings(s);
      setTimeBank(s?.time_bank || {});
      setLicenseType(s?.nurse_profile?.license_type || '');
      setShiftLines(s?.shift_lines || []);
    } finally {
      setLoading(false);
    }
  }

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Enrich shifts with period metadata for editing
  const allShifts = Object.values(periodMap).flatMap(p =>
    (p.shifts || [])
      .map((s, idx) => ({ ...s, _periodId: p.id, _shiftIdx: idx }))
      .filter(s => s.date >= yearStart && s.date <= yearEnd)
  );

  const availableYears = (() => {
    const years = new Set([currentYear]);
    Object.values(periodMap).forEach(p => (p.shifts || []).forEach(s => {
      if (s.date) years.add(parseInt(s.date.slice(0, 4)));
    }));
    return [...years].sort((a, b) => b - a);
  })();

  const updateShift = async (shiftData) => {
    const period = periodMap[editingShift._periodId];
    if (!period) return;
    const updatedShifts = (period.shifts || []).map((s, i) =>
      i === editingShift._shiftIdx ? { ...shiftData } : s
    );
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, false) : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown } : {}),
    });
    setEditingShift(null);
    load();
  };

  const deleteShift = async (shiftData) => {
    const period = periodMap[editingShift._periodId];
    if (!period) return;
    const updatedShifts = (period.shifts || []).filter((_, i) => i !== editingShift._shiftIdx);
    const breakdown = settings ? calculatePeriodBreakdown(updatedShifts, settings, false) : null;
    await base44.entities.PayPeriod.update(period.id, {
      shifts: updatedShifts,
      ...(breakdown ? { breakdown } : {}),
    });
    setEditingShift(null);
    load();
  };

  const handleEditShift = (shift) => {
    const { _periodId, _shiftIdx, ...data } = shift;
    setEditingShift({ data, _periodId, _shiftIdx });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Time Bank</h1>
            <p className="text-xs text-muted-foreground">Leave usage and entitlements</p>
          </div>
        </div>
        <select
          value={year}
          onChange={e => setYear(parseInt(e.target.value))}
          className="h-9 rounded-lg border border-border bg-background text-sm px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading...</div>
      ) : (
        <div className="space-y-4">
          {licenseType === 'ESN' && (
            <EsnCard
              shifts={allShifts.filter(s => !ESN_EXCLUDED_TYPES.includes(s.shift_type))}
              entitlement={timeBank.esn_hour_entitlement ?? 400}
              onEditShift={handleEditShift}
            />
          )}
          {CATEGORIES.map(cat => {
            const catShifts = allShifts.filter(s => cat.types.includes(s.shift_type));
            let entitlement = cat.entitlementKey ? (timeBank[cat.entitlementKey] || 0) : 0;
            let sickInfo = null;
            if (cat.key === 'sick' && shiftLines.length > 0) {
              const calculated = calculateSickLeaveEntitlement(shiftLines);
              entitlement = calculated;
              sickInfo = sickLeaveBreakdown(shiftLines);
            }
            return (
              <CategoryCard
                key={cat.key}
                category={cat}
                shifts={catShifts}
                entitlement={entitlement}
                sickInfo={sickInfo}
                onEditShift={handleEditShift}
              />
            );
          })}
        </div>
      )}

      <EditShiftDialog
        editingShift={editingShift}
        settings={settings}
        onSubmit={updateShift}
        onClose={() => setEditingShift(null)}
        onDelete={deleteShift}
      />
    </div>
  );
}
