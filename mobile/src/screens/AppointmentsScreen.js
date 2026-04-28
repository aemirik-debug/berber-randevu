import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, fetchMyAppointments } from '../services/authService';

function formatService(appointment) {
  const serviceName = appointment?.service?.name || 'Belirtilmedi';
  const price = Number(appointment?.service?.price || 0);
  if (!price) {
    return serviceName;
  }
  return `${serviceName} - ${price} TL`;
}

export default function AppointmentsScreen({ token, user, onUnauthorized }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState([]);

  const customerId = useMemo(() => user?._id || user?.id || '', [user]);

  const loadAppointments = async () => {
    if (!customerId) {
      setError('Musteri kimligi bulunamadi. Lutfen tekrar giris yapin.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const list = await fetchMyAppointments({ token, customerId });
      const sorted = [...list].sort((a, b) => {
        const aDate = `${a?.date || ''} ${a?.time || ''}`;
        const bDate = `${b?.date || ''} ${b?.time || ''}`;
        return bDate.localeCompare(aDate);
      });
      setAppointments(sorted);
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        onUnauthorized?.();
        return;
      }
      setError(err.message || 'Randevular yuklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [customerId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Randevularim</Text>
      <Text style={styles.subtitle}>Musteri hesabinizdaki randevu listesi</Text>

      <Pressable style={styles.refreshButton} onPress={loadAppointments} disabled={loading}>
        <Text style={styles.refreshButtonText}>{loading ? 'Yukleniyor...' : 'Listeyi Yenile'}</Text>
      </Pressable>

      {loading ? <ActivityIndicator size="small" color="#1f7a5a" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {appointments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Henuz randevu kaydi yok.</Text>
          </View>
        ) : (
          appointments.map((appointment, index) => (
            <View key={appointment?._id || appointment?.slotId || `${appointment?.date}-${appointment?.time}-${index}`} style={styles.card}>
              <Text style={styles.cardTitle}>{appointment?.barberSalonName || appointment?.barberName || 'Berber'}</Text>
              <Text style={styles.cardLine}>Tarih: {appointment?.date || '-'}</Text>
              <Text style={styles.cardLine}>Saat: {appointment?.time || '-'}</Text>
              <Text style={styles.cardLine}>Hizmet: {formatService(appointment)}</Text>
              <Text style={styles.cardLine}>Durum: {appointment?.status || '-'}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f4ef',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1e2a39',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#425466',
    marginBottom: 14,
  },
  refreshButton: {
    backgroundColor: '#1f7a5a',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: '#9b2c2c',
    fontSize: 14,
    marginBottom: 10,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6e2d9',
    backgroundColor: '#ffffff',
    padding: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e2a39',
    marginBottom: 6,
  },
  cardLine: {
    fontSize: 13,
    color: '#2d3d4d',
    marginBottom: 3,
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6e2d9',
    backgroundColor: '#ffffff',
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#425466',
  },
});
