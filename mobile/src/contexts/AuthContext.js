import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { configureApiClient } from '../services/apiClient';
import { saveAuthSession, getAuthSession, clearAuthSession } from '../services/storageService';
import { loginCustomer, registerCustomer, fetchMyProfile } from '../services/authService';
import { emitCustomerLogin, disconnectSocket } from '../services/socketService';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { token, user }
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const isLoggedIn = Boolean(session?.token);
  const token = session?.token || null;
  const user = session?.user || null;
  const customerId = user?._id || user?.id || '';

  // API client'ı yapılandır — token değiştiğinde güncelle
  useEffect(() => {
    configureApiClient({
      getToken: () => session?.token || null,
      onUnauthorized: () => {
        clearAuthSession();
        disconnectSocket();
        setSession(null);
      },
    });
  }, [session?.token]);

  // Uygulama açılışında oturumu geri yükle
  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const saved = await getAuthSession();
        if (active && saved?.token) {
          // Profili sunucudan doğrula
          configureApiClient({
            getToken: () => saved.token,
            onUnauthorized: () => {},
          });
          try {
            const profile = await fetchMyProfile();
            if (active) {
              const restoredSession = { token: saved.token, user: profile || saved.user };
              setSession(restoredSession);
              if (profile?._id || profile?.id) {
                emitCustomerLogin(profile._id || profile.id);
              }
            }
          } catch {
            // Token geçersiz — oturumu temizle
            await clearAuthSession();
            if (active) setSession(null);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();
    return () => { active = false; };
  }, []);

  const handleLogin = useCallback(async ({ phone, password }) => {
    setAuthLoading(true);
    try {
      const result = await loginCustomer({ phone, password });
      const nextSession = {
        token: result.token,
        user: result.customer || null,
      };

      // Profili sunucudan çek
      configureApiClient({ getToken: () => result.token, onUnauthorized: () => {} });
      try {
        const profile = await fetchMyProfile();
        if (profile) nextSession.user = profile;
      } catch {
        // Profil çekilemezse customer bilgisiyle devam et
      }

      await saveAuthSession(nextSession);
      setSession(nextSession);

      if (nextSession.user?._id || nextSession.user?.id) {
        emitCustomerLogin(nextSession.user._id || nextSession.user.id);
      }

      return nextSession;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleRegister = useCallback(async ({ phone, password }) => {
    setAuthLoading(true);
    try {
      const result = await registerCustomer({ phone, password });
      const nextSession = {
        token: result.token,
        user: result.customer || null,
      };
      await saveAuthSession(nextSession);
      setSession(nextSession);

      if (nextSession.user?._id || nextSession.user?.id) {
        emitCustomerLogin(nextSession.user._id || nextSession.user.id);
      }

      return nextSession;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    disconnectSocket();
    await clearAuthSession();
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.token) return;
    try {
      const profile = await fetchMyProfile();
      if (profile) {
        const updated = { ...session, user: profile };
        setSession(updated);
        await saveAuthSession(updated);
      }
    } catch {
      // Sessiz hata
    }
  }, [session]);

  const value = useMemo(() => ({
    session,
    token,
    user,
    customerId,
    isLoggedIn,
    loading,
    authLoading,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    refreshProfile,
  }), [session, token, user, customerId, isLoggedIn, loading, authLoading,
       handleLogin, handleRegister, handleLogout, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
