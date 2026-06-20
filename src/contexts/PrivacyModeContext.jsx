import { createContext, useContext, useState, useCallback } from 'react';

const PrivacyModeContext = createContext({ privacyMode: false, togglePrivacyMode: () => {} });

export function PrivacyModeProvider({ children }) {
  const [privacyMode, setPrivacyMode] = useState(() => {
    try { return localStorage.getItem('privacy-mode') === 'true'; } catch { return false; }
  });

  const togglePrivacyMode = useCallback(() => {
    setPrivacyMode(prev => {
      const next = !prev;
      try { localStorage.setItem('privacy-mode', String(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <PrivacyModeContext.Provider value={{ privacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyMode() {
  return useContext(PrivacyModeContext);
}
