import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type SessionState = { session: Session | null; loading: boolean; recoveryPending: boolean; setRecoveryPending: (pending: boolean) => void };
const SessionContext = createContext<SessionState>({ session: null, loading: true, recoveryPending: false, setRecoveryPending: () => {} });
export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [recoveryPending, setRecoveryPendingState] = useState(false);
  const setRecoveryPending = useCallback((pending: boolean) => setRecoveryPendingState(pending), []);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecoveryPendingState(true);
      if (event === 'SIGNED_OUT') setRecoveryPendingState(false);
      setLoading(false);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active) { setSession(data.session); setLoading(false); }
    }).catch(() => { if (active) { setSession(null); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <SessionContext.Provider value={{ session, loading, recoveryPending, setRecoveryPending }}>{children}</SessionContext.Provider>;
}
export const useSession = () => useContext(SessionContext);
