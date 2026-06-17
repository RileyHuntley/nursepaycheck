import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Trash2, Eye, Loader2, CalendarPlus, ArrowUpDown } from 'lucide-react';
import PayPeriodDialog from '@/components/payroll/PayPeriodDialog';
import { getVCHPeriodNumber } from '@/lib/statHolidays';
import { formatCurrency } from '@/lib/utils';
import { calculatePeriodBreakdown } from '@/lib/premiumCalculator';
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

export default function PayPeriodHistory() {
  const [periods, setPeriods] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const loadingRef = useRef(false);
  const loadRef = useRef(null);

  const loadPeriods = useCallback(async () => {
    if (loadingRef.current) return;
    if (loadRef.current) { clearTimeout(loadRef.current); loadRef.current = null; }
    loadingRef.current = true;
    setLoading(true);
    const [list, settingsList] = await Promise.all([
      base44.entities.PayPeriod.list('-start_date', 50),
      base44.entities.Settings.list(),
    ]);
    const userSettings = settingsList[0] || null;
    setSettings(userSettings);
    // Deduplicate by start_date and exclude empty periods
    const seen = new Set();
    const deduped = list.filter(p => {
      if (seen.has(p.start_date)) return false;
      if (!p.shifts || p.shifts.length === 0) return false;
      seen.add(p.start_date);
      return true;
    });
    setPeriods(deduped);
    loadingRef.current = false;
    setLoading(false);
  }, []);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  // Debounced subscription reload to prevent rate limiting
  const debouncedLoad = useCallback(() => {
    if (loadRef.current) clearTimeout(loadRef.current);
    loadRef.current = setTimeout(() => loadPeriods(), 900);
  }, [loadPeriods]);

  useEffect(() => {
    const unsub = base44.entities.PayPeriod.subscribe(() => debouncedLoad());
    return () => unsub();
  }, [debouncedLoad]);

  const sortedPeriods = [...periods].sort((a, b) => {
    const diff = (a.start_date || '').localeCompare(b.start_date || '');
    return sortAsc ? diff : -diff;
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await base44.entities.PayPeriod.delete(deleteTarget.id);
    setPeriods(prev => prev.filter(p => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Pay Period History</h2>
          <p className="text-sm text-muted-foreground mt-1">{periods.length} pay periods on record</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSortAsc(s => !s)} className="h-8 px-2 text-xs text-muted-foreground">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
            {sortAsc ? 'Oldest first' : 'Newest first'}
          </Button>
          <Link to="/pay-period">
            <Button size="sm" className="bg-primary text-primary-foreground">
              <CalendarPlus className="w-4 h-4 mr-2" />
              Current Period
            </Button>
          </Link>
        </div>
      </div>

      {periods.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground mb-3">No pay period history yet.</p>
          <Link to="/pay-period">
            <Button variant="outline" size="sm">
              <CalendarPlus className="w-4 h-4 mr-1.5" />
              Start Your First Pay Period
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {sortedPeriods.map((period) => (
              <div
                key={period.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors duration-150"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-foreground truncate">{period.name}</h4>
                    {getVCHPeriodNumber(period.start_date) && (
                      <span className="text-[10px] font-mono font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex-shrink-0">
                        {getVCHPeriodNumber(period.start_date)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{period.start_date} – {period.end_date}</span>
                    <span className="text-xs text-muted-foreground">{period.shifts?.length || 0} shifts</span>

                  </div>
                </div>

                {(period.breakdown || (settings && period.shifts?.length > 0)) && (
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-mono font-semibold text-primary">
                      {formatCurrency(
                        period.breakdown?.gross_pay
                        || (settings ? calculatePeriodBreakdown(period.shifts, settings).gross_pay : 0)
                      )}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {period.breakdown ? 'gross' : 'estimated gross'}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewTarget(period)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(period)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PayPeriodDialog period={viewTarget} open={!!viewTarget} onClose={() => setViewTarget(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pay period?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and all its shift data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}