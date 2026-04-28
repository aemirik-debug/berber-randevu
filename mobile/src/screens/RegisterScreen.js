import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../components/Toast';

export default function RegisterScreen({ navigation }) {
  const { register, authLoading } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    const p = phone.trim();
    const pw = password.trim();
    const cpw = confirmPassword.trim();
    if (!p || !pw) { setError('Telefon ve şifre zorunludur.'); return; }
    if (pw.length < 6) { setError('Şifre en az 6 karakter olmalıdır.'); return; }
    if (pw !== cpw) { setError('Şifreler eşleşmiyor.'); return; }
    try {
      await register({ phone: p, password: pw });
      showToast('Kayıt başarılı!', 'success');
    } catch (err) {
      setError(err.message || 'Kayıt başarısız.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brandIcon}>💈</Text>
          <Text style={styles.brand}>BerberGo</Text>
          <Text style={styles.subtitle}>Hemen ücretsiz hesap oluşturun</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Müşteri Kaydı</Text>
          <Text style={styles.cardSubtitle}>Telefon numaranız ile hızlı kayıt olun.</Text>

          <Text style={styles.label}>Telefon</Text>
          <TextInput style={styles.input} placeholder="05XX XXX XX XX" placeholderTextColor={Colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCapitalize="none" />

          <Text style={styles.label}>Şifre</Text>
          <TextInput style={styles.input} placeholder="En az 6 karakter" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />

          <Text style={styles.label}>Şifre Tekrar</Text>
          <TextInput style={styles.input} placeholder="Şifrenizi tekrar girin" placeholderTextColor={Colors.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

          <Pressable style={[styles.btn, authLoading && styles.btnDisabled]} onPress={handleSubmit} disabled={authLoading}>
            {authLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Kayıt Ol</Text>}
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.linkBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Zaten hesabınız var mı? <Text style={styles.linkBold}>Giriş Yapın</Text></Text>
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
  btn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 12, marginTop: 4 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 14, color: Colors.textSecondary },
  linkBold: { color: Colors.primary, fontWeight: '600' },
});
