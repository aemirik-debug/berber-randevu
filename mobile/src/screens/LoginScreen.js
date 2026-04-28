import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function LoginScreen({ onLogin, loading }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    if (!phone.trim() || !password.trim()) {
      setError('Telefon ve sifre zorunludur.');
      return;
    }

    try {
      await onLogin({ phone: phone.trim(), password: password.trim() });
    } catch (err) {
      setError(err.message || 'Giris basarisiz.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Musteri Girisi</Text>
      <Text style={styles.subtitle}>Randevu bilgilerine erismek icin giris yapin.</Text>

      <TextInput
        style={styles.input}
        placeholder="Telefon"
        placeholderTextColor="#8391a1"
        value={phone}
        onChangeText={setPhone}
        autoCapitalize="none"
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        placeholder="Sifre"
        placeholderTextColor="#8391a1"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Giris yapiliyor...' : 'Giris Yap'}</Text>
      </Pressable>

      {loading ? <ActivityIndicator size="small" color="#1f7a5a" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#f7f4ef',
    paddingHorizontal: 20,
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
    marginBottom: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4dbdf',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#1e2a39',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1f7a5a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    marginTop: 10,
    color: '#9b2c2c',
    fontSize: 14,
  },
});
