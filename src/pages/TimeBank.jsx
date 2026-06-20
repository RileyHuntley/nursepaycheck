import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Landmark, ChevronDown, ChevronUp } from 'lucide-react';

const HOURS_PER_DAY = 7.5;

const CATEGORIES = [
  {
    key: 'vacation',
    label: 'Vacation',
    entitlementKey: 'vacation_entitlement',
    types: ['vacation', 'unpaid_vacation'],
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50 dark:bg-blue-950',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  {
    key: 'sick',
    label: 'Sick Leave',
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

function CategoryCard({ category, shifts, entitlement }) {
  const [open, setOpen] = useState(false);

  const usedHours = shifts.reduce((sum, s) => sum + (s.paid_hours || 0), 0);
  const usedDays = usedHours / HOURS_PER_DAY;
  const hasLimit = entitlement > 0;
  const remaining = hasLimit ? Math.max(0, entitlement - usedDays) : null;
  const overLimit = hasLimit && usedDays > entitlement;
  const pct = hasLimit ? Math.min(100, (usedDays / entitlement) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{category.label}</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${category.lightColor} ${category.textColor}`}>
          {fmt(usedDays)} {usedDays === 1 ? 'day' : 'days'} used
        </span>
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

      {!hasLimit && (
        <p className="text-xs text-muted-foreground">No annual limit set — configure in Pay Configuration.</p>
      )}

      {shifts.length > 0 && (
        <div>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {open ? 'Hide' : 'Show'} {shifts.length} {shifts.length === 1 ? 'shift' : 'shifts'}
          </button>
          {open && (
            <div className="mt-2 rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-right px-3 py-2 font-medium">Hours</th>
                    <th className="text-right px-3 py-2 font-medium">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.sort((a, b) => a.date.localeCompare(b.date)).map((s, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 font-mono">{s.date}</td>
                      <td className="px-3 py-2 text-muted-foreground capitalize">{s.shift_type.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-right font-mono">{s.paid_hours}h</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(s.paid_hours / HOURS_PER_DAY)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {shifts.length === 0 && (
        <p className="text-xs text-muted-foreground">No {category.label.toLowerCase()} shifts recorded this year.</p>
      )}
    </div>
  );
}

export default function TimeBank() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [periods, setPeriods] = useState([]);
  const [timeBank, setTimeBank] = useState({});
  const [loading, setLoading] = useState(true);
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
      setPeriods(periodsData);
      setTimeBank(settingsList[0]?.time_bank || {});
    } finally {
      setLoading(false);
    }
  }

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const allShifts = periods.flatMap(p => (p.shifts || []).filter(
    s => s.date >= yearStart && s.date <= yearEnd
  ));

  const availableYears = (() => {
    const years = new Set([currentYear]);
    periods.forEach(p => (p.shifts || []).forEach(s => {
      if (s.date) years.add(parseInt(s.date.slice(0, 4)));
    }));
    return [...years].sort((a, b) => b - a);
  })();

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
          {CATEGORIES.map(cat => {
            const catShifts = allShifts.filter(s => cat.types.includes(s.shift_type));
            const entitlement = cat.entitlementKey ? (timeBank[cat.entitlementKey] || 0) : 0;
            return (
              <CategoryCard
                key={cat.key}
                category={cat}
                shifts={catShifts}
                entitlement={entitlement}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
