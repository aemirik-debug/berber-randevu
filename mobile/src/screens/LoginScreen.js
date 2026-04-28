import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../components/Toast';

export default function LoginScreen({ navigation }) {
  const { login, authLoading } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    const p = phone.trim();
    const pw = password.trim();
    if (!p || !pw) { setError('Telefon ve şifre zorunludur.'); return; }
    try {
      await login({ phone: p, password: pw });
      showToast('Giriş başarılı!', 'success');
    } catch (err) {
      setError(err.message || 'Giriş başarısız.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brandIcon}>💈</Text>
          <Text style={styles.brand}>BerberGo</Text>
          <Text style={styles.subtitle}>Profesyonel Berber Randevu Sistemi</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Müşteri Girişi</Text>
          <Text style={styles.cardSubtitle}>Randevu bilgilerine erişmek için giriş yapın.</Text>

          <Text style={styles.label}>Telefon</Text>
          <TextInput style={styles.input} placeholder="05XX XXX XX XX" placeholderTextColor={Colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" />

          <Text style={styles.label}>Şifre</Text>
          <TextInput style={styles.input} placeholder="Şifrenizi girin" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />

          <Pressable style={styles.forgotBtn} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotText}>Şifremi Unuttum</Text>
          </Pressable>

          <Pressable style={[styles.btn, authLoading && styles.btnDisabled]} onPress={handleSubmit} disabled={authLoading}>
            {authLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Giriş Yap</Text>}
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>Hesabınız yok mu? <Text style={styles.linkBold}>Kayıt Olun</Text></Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 32 },
  brandIcon: { fontSize: 48, marginBottom: 8 },
  brand: { fontSize: 32, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.inputBg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, marginBottom: 14 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 8, marginTop: -6 },
  forgotText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  btn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 12, marginTop: 4 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 14, color: Colors.textSecondary },
  linkBold: { color: Colors.primary, fontWeight: '600' },
});
