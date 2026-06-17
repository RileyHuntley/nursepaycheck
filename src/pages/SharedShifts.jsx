import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ShiftCalendarGrid from '@/components/payroll/ShiftCalendarGrid';
import PayBreakdown from '@/components/payroll/PayBreakdown';
import { calculatePeriodBreakdown, getPayPeriodForDate } from '@/lib/premiumCalculator';
import { getVCHPeriodNumber } from '@/lib/statHolidays';
import { formatCurrency } from '@/lib/utils';

export default function SharedShifts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (!token) {
      setError('No share token provided.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const links = await base44.entities.ShareLink.filter({ token });
        if (links.length === 0) {
          setError('This share link is invalid or has been revoked.');
          setLoading(false);
          return;
        }
        const link = links[0];
        setData({
          settings: link.settings_data || {},
          payPeriods: link.pay_periods_data || [],
        });
        setLoading(false);
      } catch (e) {
        setError('This share link is invalid or has been revoked.');
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center space-y-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary/70">NursePayCheck</p>
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Unavailable</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const settings = data?.settings || null;
  const payPeriods = Array.isArray(data?.payPeriods) ? data.payPeriods : [];

  // Build shiftsMap for calendar
  const shiftsMap = {};
  payPeriods.forEach(period => {
    (period.shifts || []).forEach(shift => {
      if (!shiftsMap[shift.date]) shiftsMap[shift.date] = [];
      shiftsMap[shift.date].push(shift);
    });
  });

  // In SharedShifts.jsx
  if (!settings) {
   return <div className="p-8 text-center">Settings not found for this shared view.</div>;
  }
  
  // Sort all periods chronologically (oldest first)
  const sortedPeriods = [...payPeriods].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

  // Find current pay period (where today falls)
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentPd = getPayPeriodForDate(todayStr);
  const currentPeriod = sortedPeriods.find(p => p.start_date === currentPd.start_date && p.end_date === currentPd.end_date);
  const currentBreakdown = currentPeriod && settings
    ? calculatePeriodBreakdown(currentPeriod.shifts || [], settings)
    : null;

  // Year-to-date gross sum
  const ytdGross = payPeriods.reduce((sum, p) => sum + (p.breakdown?.gross_pay || 0), 0);
  const showPayInfo = settings.show_pay_info === true;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <header className="text-center space-y-2">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary/70">NursePayCheck</p>
          <h1 className="text-2xl font-display font-bold text-foreground">{(settings.user_name || 'Nurse')}&rsquo;s Shift Tracker</h1>
          {showPayInfo && (
            <p className="text-sm text-muted-foreground">
              {payPeriods.length} pay period{payPeriods.length !== 1 ? 's' : ''} ·{' '}
              Estimated Income This Year: <span className="font-mono font-semibold text-foreground">{formatCurrency(ytdGross)}</span>
            </p>
          )}
        </header>

        <ShiftCalendarGrid
          settings={settings}
          shiftsMap={shiftsMap}
          showHeader={false}
          readOnly={true}
        />

        {showPayInfo && currentBreakdown && currentPeriod && (
          <section className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Current Period</h3>
                <p className="text-xs text-muted-foreground">{currentPeriod.name} · PP {getVCHPeriodNumber(currentPeriod.start_date) || '—'}</p>
              </div>
            </div>
            <PayBreakdown
              breakdown={currentBreakdown}
              wage={settings.hourly_wage}
              taxSettings={settings.tax_settings}
            />
          </section>
        )}

        {/* Period history */}
        {showPayInfo && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">All Pay Periods</h3>
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {sortedPeriods.map(period => (
                <div key={period.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{period.name}</p>
                    <p className="text-xs text-muted-foreground">{period.name} · PP {getVCHPeriodNumber(period.start_date) || '—'} · {period.shifts?.length || 0} shifts</p>
                  </div>
                  {period.breakdown && (
                    <span className="text-sm font-mono font-semibold text-primary flex-shrink-0">
                      {formatCurrency(period.breakdown.gross_pay || 0)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="text-center text-xs text-muted-foreground pb-8">
          View-only share link · Generated by {(settings.user_name || 'Nurse')} using NursePayCheck
        </footer>
      </div>
    </div>
  );
}