import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/payroll/Sidebar';
import NamePrompt from '@/components/payroll/NamePrompt';
import { useAuth } from '@/lib/AuthContext';
import { PrivacyModeProvider } from '@/contexts/PrivacyModeContext';

export default function Layout() {
  const { user, isLoadingAuth } = useAuth();
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && user && !user.full_name && !user.display_name) setShowNamePrompt(true);
  }, [user, isLoadingAuth]);

  return (
    <PrivacyModeProvider>
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
    </PrivacyModeProvider>
  );
}