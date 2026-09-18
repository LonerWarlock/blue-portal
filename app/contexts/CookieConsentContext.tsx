'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type ConsentChoice = 'all' | 'essential' | null;

interface CookieConsentContextType {
  consent: ConsentChoice;
  hasChosen: boolean;
  acceptAll: () => void;
  acceptEssential: () => void;
  resetConsent: () => void;
}

const STORAGE_KEY = 'blue-cookie-consent';

const CookieConsentContext = createContext<CookieConsentContextType>({
  consent: null,
  hasChosen: false,
  acceptAll: () => {},
  acceptEssential: () => {},
  resetConsent: () => {},
});

export function useCookieConsent() {
  return useContext(CookieConsentContext);
}

function readConsent(): ConsentChoice {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'all' || val === 'essential') return val;
  } catch {}
  return null;
}

function writeConsent(choice: ConsentChoice) {
  if (typeof window === 'undefined') return;
  try {
    if (choice) {
      localStorage.setItem(STORAGE_KEY, choice);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentChoice>(null);
  const [hasChosen, setHasChosen] = useState(false);

  useEffect(() => {
    const saved = readConsent();
    if (saved) {
      setConsent(saved);
      setHasChosen(true);
    }
  }, []);

  const acceptAll = useCallback(() => {
    setConsent('all');
    setHasChosen(true);
    writeConsent('all');
  }, []);

  const acceptEssential = useCallback(() => {
    setConsent('essential');
    setHasChosen(true);
    writeConsent('essential');
  }, []);

  const resetConsent = useCallback(() => {
    setConsent(null);
    setHasChosen(false);
    writeConsent(null);
  }, []);

  return (
    <CookieConsentContext.Provider value={{ consent, hasChosen, acceptAll, acceptEssential, resetConsent }}>
      {children}
    </CookieConsentContext.Provider>
  );
}
