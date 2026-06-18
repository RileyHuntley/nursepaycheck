import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Shield, UserCircle, RefreshCw } from 'lucide-react';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadUsers = useCallback((showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    base44.entities.User.list().then(list => {
      setUsers(list.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email)));
      setLoading(false);
      setRefreshing(false);
    }).catch(() => {
      setLoading(false);
      setRefreshing(false);
    });
  }, []);

  useEffect(() => {
    loadUsers(true);
    const unsub = base44.entities.User.subscribe(() => loadUsers(false));
    return unsub;
  }, [loadUsers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">Admin</h2>
          <p className="text-sm text-muted-foreground mt-1">View and support other users</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => loadUsers(false)} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm max-w-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <Link
              key={u.id}
              to={`/admin/support/${u.id}`}
              className="flex items-center gap-3 bg-card border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <UserCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {u.full_name || u.display_name || 'Unnamed User'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {u.role === 'admin' && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3" />
                    Admin
                  </span>
                )}
                <span className="text-xs text-muted-foreground">View →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}