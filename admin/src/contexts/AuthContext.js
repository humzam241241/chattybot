'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  subscription: null,
  hasAccess: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshSubscription: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const hasAccess = isAdmin || 
    subscription?.status === 'active' || 
    subscription?.status === 'lifetime' ||
    (subscription?.status === 'trialing' && 
     subscription?.trialEndsAt && 
     new Date(subscription.trialEndsAt) > new Date());

  async function fetchMe(accessToken) {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/me', {
        headers: { 'X-Supabase-Token': accessToken },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(Boolean(data?.user?.is_admin));
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    }
  }

  async function fetchSubscription(accessToken) {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/stripe/subscription', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.access_token) {
        fetchMe(session.access_token);
        fetchSubscription(session.access_token);
      }
      setLoading(false);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.access_token) {
          fetchMe(session.access_token);
          fetchSubscription(session.access_token);
        } else {
          setSubscription(null);
          setIsAdmin(false);
        }
      }
    );

    return () => authSub.unsubscribe();
  }, []);

  async function signIn(email, password) {
    if (!supabase) throw new Error('Auth not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password) {
    if (!supabase) throw new Error('Auth not configured');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setSubscription(null);
    setIsAdmin(false);
  }

  async function refreshSubscription() {
    if (session?.access_token) {
      await fetchSubscription(session.access_token);
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isAdmin,
      subscription,
      hasAccess,
      signIn,
      signUp,
      signOut,
      refreshSubscription,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
