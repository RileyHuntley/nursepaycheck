import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarPlus, Clock, Settings, PanelLeftClose, PanelLeftOpen, ExternalLink, List, Sun, Moon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { HA_PORTALS, getUserHealthAuthorities } from '@/lib/healthAuthorityPortals';
import { useTheme } from 'next-themes';

const todayStr = new Date().toISOString().slice(0, 10);

function countPendingVerification(periods) {
  let count = 0;
  for (const p of periods) {
    if (!p.end_date || todayStr <= p.end_date) continue; // period hasn't ended
    for (const s of (p.shifts || [])) {
      if (s.status === 'verified') continue;
      if (s.status === 'upcoming') continue;
      if (!s.date) continue;
      // pending if past date or status is explicitly pending
      if (s.status === 'pending' || s.date <= todayStr) count++;
    }
  }
  return count;
}

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/shift-log', icon: List, label: 'Shifts' },
  { to: '/pay-period', icon: CalendarPlus, label: 'Current Pay Period' },
  { to: '/pay-periods', icon: Clock, label: 'Pay Period History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const [healthAuthorities, setHealthAuthorities] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const load = async () => {
      const list = await base44.entities.Settings.list();
      if (list.length > 0) {
        setHealthAuthorities(getUserHealthAuthorities(list[0].hospitals || []));
      }
    };
    load();
    const unsub = base44.entities.Settings.subscribe(async () => {
      const list = await base44.entities.Settings.list();
      if (list.length > 0) {
        setHealthAuthorities(getUserHealthAuthorities(list[0].hospitals || []));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const load = async () => {
      const periods = await base44.entities.PayPeriod.list();
      setPendingCount(countPendingVerification(periods));
    };
    load();
    const unsub = base44.entities.PayPeriod.subscribe(async () => {
      const periods = await base44.entities.PayPeriod.list();
      setPendingCount(countPendingVerification(periods));
    });
    return () => unsub();
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', next);
  };

  const haLinks = healthAuthorities.flatMap(ha => {
    const portal = HA_PORTALS[ha];
    if (!portal) return [];
    const entries = [];
    if (portal.schedule) entries.push({ ...portal.schedule, ha, haLabel: portal.label, type: 'schedule' });
    if (portal.pay) entries.push({ ...portal.pay, ha, haLabel: portal.label, type: 'pay' });
    return entries;
  });

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
            <p className="text-xs text-muted-foreground mt-0.5">NBA Pay Tracker</p>
          </>
        )}
      </div>
      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150 relative ${
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
            {to === '/shift-log' && pendingCount > 0 && (
              <span className={`absolute flex items-center justify-center rounded-full bg-chart-2 text-white text-[10px] font-bold ${collapsed ? 'top-1 right-1 w-4 h-4' : 'ml-auto w-5 h-5'}`}>
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}

        {/* External health authority links */}
        {haLinks.length > 0 && (
          <>
            <div className={`pt-4 pb-1 ${collapsed ? 'px-0' : 'px-3'}`}>
              {!collapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">External Links</p>
              )}
            </div>
            {haLinks.map((link) => (
              <a
                key={`${link.ha}-${link.type}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={collapsed ? `${link.label} [${link.ha}]` : undefined}
                className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                  collapsed ? 'justify-center px-0 py-2.5 w-full' : 'px-3 py-2.5'
                }`}
              >
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                {!collapsed && (
                  <span className="truncate">
                    {link.label}
                    <span className="text-[10px] text-muted-foreground font-normal ml-1.5">[{link.ha}]</span>
                  </span>
                )}
              </a>
            ))}
          </>
        )}
      </nav>
      <div className={`border-t border-sidebar-border flex items-center ${collapsed ? 'justify-center px-2 py-4' : 'justify-between px-5 py-4'}`}>
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="text-muted-foreground hover:text-sidebar-foreground transition-colors p-1 rounded-md hover:bg-sidebar-accent"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {!collapsed && <span className="text-[10px] text-muted-foreground ml-1">{isDark ? 'Light' : 'Dark'}</span>}
        <div className="flex-1" />
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