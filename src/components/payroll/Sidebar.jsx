import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarPlus, Clock, Settings, CalendarDays, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pay-period', icon: CalendarPlus, label: 'Current Pay Period' },
  { to: '/calendar', icon: CalendarDays, label: 'Shift Calendar' },
  { to: '/pay-periods', icon: Clock, label: 'Pay Period History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', next);
  };

  return (
    <aside className={`flex-shrink-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className={`px-5 py-6 border-b border-sidebar-border ${collapsed ? 'px-2 text-center' : ''}`}>
        {collapsed ? (
          <h1 className="text-sm font-display font-bold tracking-tight text-sidebar-foreground">
            N<span className="text-primary">P</span>C
          </h1>
        ) : (
          <>
            <h1 className="text-lg font-display font-semibold tracking-tight text-sidebar-foreground">
              Nurse<span className="text-primary">Pay</span>Check
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">NBA Paystub Verifier</p>
          </>
        )}
      </div>
      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150 ${
                collapsed ? 'justify-center px-0 py-2.5 w-full' : 'px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>
      <div className={`border-t border-sidebar-border flex items-center ${collapsed ? 'justify-center px-2 py-4' : 'justify-between px-5 py-4'}`}>
        {!collapsed && <span className="text-xs text-muted-foreground">NBA CBA Calculator</span>}
        <button
          onClick={toggle}
          className="text-muted-foreground hover:text-sidebar-foreground transition-colors p-1 rounded-md hover:bg-sidebar-accent"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}