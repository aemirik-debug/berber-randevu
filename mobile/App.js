import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import AppointmentsScreen from './src/screens/AppointmentsScreen';
import LoginScreen from './src/screens/LoginScreen';
import { ApiError, fetchMyProfile, loginCustomer } from './src/services/authService';
import { clearAuthSession, getAuthSession, saveAuthSession } from './src/services/storageService';

export default function App() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const saved = await getAuthSession();
        if (active && saved?.token) {
          try {
            const profile = await fetchMyProfile(saved.token);
            setSession({ token: saved.token, user: profile || saved.user });
          } catch (error) {
            if (error instanceof ApiError && error.isUnauthorized) {
              await clearAuthSession();
              setSession(null);
            } else {
              throw error;
            }
          }
        }
      } finally {
        if (active) {
          setSessionLoading(false);
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async ({ phone, password }) => {
    setAuthLoading(true);
    try {
      const result = await loginCustomer({ phone, password });
      const profile = await fetchMyProfile(result.token).catch(() => result.customer);
      const nextSession = {
        token: result.token,
        user: profile,
      };

      await saveAuthSession(nextSession);
      setSession(nextSession);
      setActiveTab('home');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearAuthSession();
    setSession(null);
    setActiveTab('home');
  };

  const handleUnauthorized = async () => {
    await clearAuthSession();
    setSession(null);
    setActiveTab('home');
  };

  if (sessionLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1f7a5a" />
      </View>
    );
  }

  return (
    <>
      {session?.token ? (
        <View style={styles.appShell}>
          <View style={styles.content}>
            {activeTab === 'home' ? (
              <HomeScreen
                token={session.token}
                user={session.user}
                onLogout={handleLogout}
                onUnauthorized={handleUnauthorized}
              />
            ) : (
              <AppointmentsScreen
                token={session.token}
                user={session.user}
                onUnauthorized={handleUnauthorized}
              />
            )}
          </View>

          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setActiveTab('home')}
              style={[styles.tabButton, activeTab === 'home' ? styles.tabButtonActive : null]}
            >
              <Text style={[styles.tabText, activeTab === 'home' ? styles.tabTextActive : null]}>Anasayfa</Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('appointments')}
              style={[styles.tabButton, activeTab === 'appointments' ? styles.tabButtonActive : null]}
            >
              <Text style={[styles.tabText, activeTab === 'appointments' ? styles.tabTextActive : null]}>Randevularim</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <LoginScreen onLogin={handleLogin} loading={authLoading} />
      )}
      <StatusBar style="dark" />
    </>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#f7f4ef',
  },
  content: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f4ef',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e6e2d9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4dbdf',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  tabButtonActive: {
    borderColor: '#1f7a5a',
    backgroundColor: '#edf7f3',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#425466',
  },
  tabTextActive: {
    color: '#1f7a5a',
  },
});
