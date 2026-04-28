import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError, fetchLiveDashboard } from '../services/authService';

export default function HomeScreen({ token, user, onLogout, onUnauthorized }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [liveData, setLiveData] = useState({
    apiMessage: '-',
    totalBarbers: 0,
    onlineBarbers: 0,
  });

  const displayName = useMemo(() => {
    const name = String(user?.name || '').trim();
    const surname = String(user?.surname || '').trim();
    const fullName = `${name} ${surname}`.trim();
    if (fullName) return fullName;
    return user?.phone || 'Musteri';
  }, [user]);

  const loadLiveData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchLiveDashboard(token);
      setLiveData(data);
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        onUnauthorized?.();
        return;
      }
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Berber Randevu Mobile</Text>
      <Text style={styles.subtitle}>Hos geldin, {displayName}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Canli Sistem Karti</Text>
        <Text style={styles.cardLine}>API: {liveData.apiMessage}</Text>
        <Text style={styles.cardLine}>Toplam berber: {liveData.totalBarbers}</Text>
        <Text style={styles.cardLine}>Aktif berber: {liveData.onlineBarbers}</Text>
      </View>

      <Pressable style={styles.button} onPress={loadLiveData} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Yenileniyor...' : 'Canli Veriyi Yenile'}</Text>
      </Pressable>

      <Pressable style={styles.logoutButton} onPress={onLogout} disabled={loading}>
        <Text style={styles.logoutButtonText}>Cikis Yap</Text>
      </Pressable>

      {loading ? <ActivityIndicator size="small" color="#1f7a5a" /> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: '#f7f4ef',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e2a39',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#425466',
    marginBottom: 18,
  },
  card: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e6e2d9',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e2a39',
    marginBottom: 8,
  },
  cardLine: {
    fontSize: 14,
    color: '#2d3d4d',
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#1f7a5a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cfd8dc',
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  logoutButtonText: {
    color: '#425466',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    fontSize: 14,
    color: '#9b2c2c',
    lineHeight: 20,
  },
});
