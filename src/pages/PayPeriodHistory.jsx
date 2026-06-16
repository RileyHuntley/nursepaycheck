import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Trash2, Eye, Loader2, CalendarPlus } from 'lucide-react';
import { getVCHPeriodNumber, VCH_PAY_PERIODS_2026 } from '@/lib/statHolidays';
import { getPayPeriodName } from '@/lib/premiumCalculator';
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
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    const list = await base44.entities.PayPeriod.list('-start_date', 50);

    // Auto-generate missing VCH periods for the current year up to today's period + 1 ahead
    const today = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const currentIdx = VCH_PAY_PERIODS_2026.findIndex(p => today >= p.start && today <= p.end);
    const endIdx = currentIdx >= 0 ? Math.min(currentIdx + 1, VCH_PAY_PERIODS_2026.length - 1) : VCH_PAY_PERIODS_2026.length - 1;
    const existingStarts = new Set(list.map(p => p.start_date));
    const missingPeriods = VCH_PAY_PERIODS_2026
      .filter((p, i) => p.start >= yearStart && i <= endIdx && !existingStarts.has(p.start))
      .map(vp => ({
        name: getPayPeriodName(vp.start, vp.end),
        start_date: vp.start,
        end_date: vp.end,
        shifts: [],
        status: 'draft',
      }));
    if (missingPeriods.length > 0) {
      await base44.entities.PayPeriod.bulkCreate(missingPeriods);
      const updated = await base44.entities.PayPeriod.list('-start_date', 50);
      setPeriods(updated);
    } else {
      setPeriods(list);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  useEffect(() => {
    const unsub = base44.entities.PayPeriod.subscribe(() => loadPeriods());
    return () => unsub();
  }, [loadPeriods]);

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
        <Link to="/pay-period">
          <Button size="sm" className="bg-primary text-primary-foreground">
            <CalendarPlus className="w-4 h-4 mr-2" />
            Current Period
          </Button>
        </Link>
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
            {periods.map((period) => (
              <div
                key={period.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors duration-150"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-foreground truncate">{period.name}</h4>
                    {getVCHPeriodNumber(period.start_date) && (
                      <span className="text-[10px] font-mono font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex-shrink-0">
                        PP {getVCHPeriodNumber(period.start_date)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{period.start_date} – {period.end_date}</span>
                    <span className="text-xs text-muted-foreground">{period.shifts?.length || 0} shifts</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      period.status === 'calculated'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-chart-2/15 text-chart-2'
                    }`}>
                      {period.status === 'calculated' ? 'Calculated' : 'Draft'}
                    </span>
                  </div>
                </div>

                {period.breakdown && (
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-mono font-semibold text-primary">${period.breakdown.gross_pay?.toFixed(2) || '0.00'}</span>
                    <p className="text-[10px] text-muted-foreground">gross</p>
                  </div>
                )}

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link to={`/pay-period?period=${period.id}`}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
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