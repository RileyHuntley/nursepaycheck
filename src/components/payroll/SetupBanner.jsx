import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, DollarSign, MapPin, CalendarPlus } from 'lucide-react';

export default function SetupBanner({ hasShifts, hasWage, hasTaxSettings }) {
  if (hasShifts) return null;

  const steps = [
    {
      icon: DollarSign,
      label: 'Set your hourly wage, monthly allowances, & shift differentials',
      to: '/pay-configuration',
      done: hasWage,
    },
    {
      icon: MapPin,
      label: 'Add your hospitals & shift defaults',
      to: '/shift-configuration',
      done: false, // we don't track this granularly; always show as actionable
    },
    {
      icon: CalendarPlus,
      label: 'Start logging your shifts',
      to: '/shift-log',
      done: false,
    },
  ];

  const allDone = steps.every(s => s.done);

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 space-y-5">
      <div>
        <h3 className="text-lg font-display font-bold text-foreground">Welcome to NursePayCheck 👋</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Let's get you set up in a few quick steps so your shift calculations work accurately from day one.
        </p>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border">
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${step.done ? 'bg-chart-4/15' : 'bg-primary/10'}`}>
              <step.icon className={`w-4 h-4 ${step.done ? 'text-chart-4' : 'text-primary'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium ${step.done ? 'text-chart-4' : 'text-foreground'}`}>
                {i + 1}. {step.label}
              </span>
              {step.done && <span className="ml-2 text-[11px] text-chart-4 font-medium">✓ Done</span>}
            </div>
            {!step.done && (
              <Link to={step.to} className="flex-shrink-0">
                <Button size="sm" variant={i === 0 ? 'default' : 'outline'} className={i === 0 ? 'bg-primary text-primary-foreground' : ''}>
                  Go <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>

      {allDone && (
        <p className="text-sm text-chart-4 font-medium">All set! Start adding shifts to see your pay breakdowns.</p>
      )}
    </div>
  );
}