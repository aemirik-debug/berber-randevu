import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { checkApiHealth } from '../services/healthService';

export default function HomeScreen() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Mobil uygulama hazir. API baglanti kontrolu yapabilirsiniz.');

  const handleCheckApi = async () => {
    setLoading(true);
    try {
      const data = await checkApiHealth();
      const apiMessage = data?.message || 'API erisimi basarili.';
      setMessage(`Baglanti basarili: ${apiMessage}`);
    } catch (error) {
      setMessage(`Baglanti hatasi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Berber Randevu Mobile</Text>
      <Text style={styles.subtitle}>Expo + React Native baslangic kurulumu tamamlandi.</Text>

      <Pressable style={styles.button} onPress={handleCheckApi} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Kontrol ediliyor...' : 'API Baglantisini Test Et'}</Text>
      </Pressable>

      {loading ? <ActivityIndicator size="small" color="#1f7a5a" /> : null}

      <Text style={styles.message}>{message}</Text>
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
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#1f7a5a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    color: '#26323f',
    lineHeight: 20,
  },
});
