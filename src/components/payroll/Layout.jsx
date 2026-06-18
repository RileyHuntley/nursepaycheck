import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/payroll/Sidebar';
import NamePrompt from '@/components/payroll/NamePrompt';
import { base44 } from '@/api/base44Client';

export default function Layout() {
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user && !user.full_name) setShowNamePrompt(true);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
      {showNamePrompt && (
        <NamePrompt onDone={() => setShowNamePrompt(false)} />
      )}
    </div>
  );
}