import { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

export default function AdminRoute() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setIsAdmin(u?.role === 'admin');
      setChecking(false);
    }).catch(() => {
      setIsAdmin(false);
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}