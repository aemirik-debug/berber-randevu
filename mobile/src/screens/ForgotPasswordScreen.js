import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../theme/colors';
import { api } from '../services/apiClient';
import { showToast } from '../components/Toast';

export default function ForgotPasswordScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    setError('');
    const p = phone.trim();
    if (!p) { setError('Telefon numarası zorunludur.'); return; }
    if (!newPassword || newPassword.length < 6) { setError('Yeni şifre en az 6 karakter olmalıdır.'); return; }
    if (newPassword !== confirmPassword) { setError('Şifreler eşleşmiyor.'); return; }

    setLoading(true);
    try {
      const result = await api.post('/customers/reset-password', { phone: p, newPassword });
      showToast(result.message || 'Şifreniz güncellendi!', 'success');
      setTimeout(() => navigation.goBack(), 1500);
    } catch (err) {
      setError(err.message || 'Şifre sıfırlama başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brandIcon}>🔐</Text>
          <Text style={styles.title}>Şifremi Unuttum</Text>
          <Text style={styles.subtitle}>Telefon numaranızla yeni şifre belirleyin.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Telefon Numaranız</Text>
          <TextInput
            style={styles.input}
            placeholder="05XX XXX XX XX"
            placeholderTextColor={Colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Yeni Şifre</Text>
          <TextInput
            style={styles.input}
            placeholder="En az 6 karakter"
            placeholderTextColor={Colors.textMuted}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />

          <Text style={styles.label}>Yeni Şifre Tekrar</Text>
          <TextInput
            style={styles.input}
            placeholder="Şifreyi tekrar girin"
            placeholderTextColor={Colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={handleReset} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Şifremi Güncelle</Text>}
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.linkBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>← Giriş ekranına dön</Text>
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
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.inputBg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, marginBottom: 14 },
  btn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 12, marginTop: 4 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: Colors.danger, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
});
