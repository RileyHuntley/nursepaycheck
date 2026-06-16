import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarPlus, Clock, Settings, CalendarDays } from 'lucide-react';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pay-period', icon: CalendarPlus, label: 'Current Pay Period' },
  { to: '/calendar', icon: CalendarDays, label: 'Shift Calendar' },
  { to: '/pay-periods', icon: Clock, label: 'Pay Period History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="w-60 flex-shrink-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="px-5 py-6 border-b border-sidebar-border">
        <h1 className="text-lg font-display font-semibold tracking-tight text-sidebar-foreground">
          Nurse<span className="text-primary">Pay</span>Check
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">NBA Paystub Verifier</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-sidebar-border text-xs text-muted-foreground">
        NBA CBA Calculator
      </div>
    </aside>
  );
}