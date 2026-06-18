import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Calculator, ClipboardCheck, TrendingUp, Shield, ArrowRight, Moon, Sun, Calendar, BarChart3, Mail, ExternalLink
} from 'lucide-react';

const features = [
  {
    icon: Calculator,
    title: 'Auto-Calculate NBA Premiums',
    description: 'Evening, night, weekend, super shift, specialty, preceptor, and more — all calculated per the BCNU collective agreement so you never miss a dollar.',
  },
  {
    icon: ClipboardCheck,
    title: 'Audit Your Pay Stubs',
    description: 'Compare your calculated expected pay against what actually lands in your bank account. Catch underpayments before they pile up.',
  },
  {
    icon: TrendingUp,
    title: 'Track Earnings Over Time',
    description: 'Monthly and year-to-date summaries, trend charts, and pay period histories give you a clear picture of your income.',
  },
  {
    icon: Calendar,
    title: 'Visual Shift Calendar',
    description: 'See your schedule at a glance with stat holidays, pay dates, and night/day shift indicators — all colour-coded and filterable.',
  },
  {
    icon: BarChart3,
    title: 'Export & Share',
    description: 'Generate PDF pay period summaries and optionally share your calendar (without pay info) with family or colleagues.',
  },
  {
    icon: Shield,
    title: 'Private & Secure',
    description: 'Your data is yours alone. Only you see your earnings. We never sell or share your information.',
  },
];

export default function Landing() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    base44.auth.isAuthenticated().then(isAuth => {
      setAuthed(isAuth);
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authed) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-6 h-6 text-primary" />
            <span className="text-lg font-display font-bold text-foreground">
              Nurse<span className="text-primary">Pay</span>Check
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-primary text-primary-foreground">Get Started — Free</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chart-4/10 text-chart-4 text-xs font-semibold mb-6">
            <Shield className="w-3.5 h-3.5" /> 100% Free — No Trials, No Upsells
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground tracking-tight leading-tight">
            Know exactly what your<br />
            <span className="text-primary">paycheque should be</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Built for BC nurses under the NBA collective agreement. Log your shifts, we calculate every premium and differential — so you can verify every pay stub with confidence.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="bg-primary text-primary-foreground text-base px-8 h-12">
                Create Your Free Account <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="text-base px-8 h-12">
                I already have an account
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card. No subscription. Just a tool for nurses, by nurses.
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 bg-muted/30 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
              Everything you need to audit your pay
            </h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Built around the BCNU NBA collective agreement — not generic payroll software.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-display font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            Started by a BC nurse who was tired of spreadsheet math
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            The NBA has dozens of premiums that change based on shift type, time of day, and stat holidays.
            NursePayCheck handles all of it automatically — so you can focus on what matters.
          </p>
          <div className="mt-8">
            <Link to="/register">
              <Button size="lg" className="bg-primary text-primary-foreground text-base px-10 h-12">
                Start Tracking for Free <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calculator className="w-4 h-4 text-primary" />
            <span>Nurse<span className="text-primary font-medium">Pay</span>Check</span>
            <span className="mx-2">·</span>
            <span>Free forever</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="https://www.bcnu.org/Contracts-Bargaining/Documents/nba-pca_2022_2025.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
              NBA Collective Agreement <ExternalLink className="w-3 h-3" />
            </a>
            <Link to="/login" className="hover:text-foreground transition-colors">Log in</Link>
            <Link to="/register" className="hover:text-foreground transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}