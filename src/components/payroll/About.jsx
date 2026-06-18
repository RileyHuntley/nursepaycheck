import { Info, ExternalLink } from 'lucide-react';

const APP_VERSION = '1.3.0';

export default function About() {
  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">About</h3>
        <p className="text-xs text-muted-foreground mt-1">
          NursePayCheck — a personalized payroll verification tool for BC Nurses' Union members.
        </p>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5" />
          <span>Version <span className="font-mono text-foreground font-medium">{APP_VERSION}</span></span>
        </div>
        <p>
          Premium calculations follow the NBA collective agreement as of April 1, 2025.
          Tax and statutory estimates are approximations and should be verified against your actual pay stub.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <a
            href="mailto:support@nursepaycheck.ca"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Contact Support
          </a>
          <span className="text-border">|</span>
          <a
            href="https://bcnu.org/collective-agreement"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            BCNU Collective Agreement
          </a>
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-2">
          &copy; {new Date().getFullYear()} NursePayCheck. This tool provides estimates only and is not affiliated with any health authority or union.
        </p>
      </div>
    </section>
  );
}