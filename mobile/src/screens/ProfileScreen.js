import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile, updatePassword } from '../services/authService';
import { fetchCities, fetchDistricts } from '../services/barberService';
import { showToast } from '../components/Toast';

export default function ProfileScreen({ navigation }) {
  const { user, customerId, logout, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [surname, setSurname] = useState(user?.surname || '');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState(user?.address || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileCity, setProfileCity] = useState(user?.city || '');
  const [profileDistrict, setProfileDistrict] = useState(user?.district || '');
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => { fetchCities().then(setCities).catch(() => {}); }, []);
  useEffect(() => {
    if (!profileCity) { setDistricts([]); return; }
    fetchDistricts(profileCity).then(setDistricts).catch(() => setDistricts([]));
  }, [profileCity]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile(customerId, { name, surname, email, address, phone, city: profileCity, district: profileDistrict });
      await refreshProfile();
      showToast('Profil güncellendi.', 'success');
    } catch (err) { showToast(err.message || 'Güncellenemedi.', 'danger'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) { showToast('Eski ve yeni şifre zorunlu.', 'danger'); return; }
    if (newPassword.length < 6) { showToast('Yeni şifre en az 6 karakter.', 'danger'); return; }
    setSavingPassword(true);
    try {
      await updatePassword(customerId, { oldPassword, newPassword });
      setOldPassword('');
      setNewPassword('');
      showToast('Şifre güncellendi.', 'success');
    } catch (err) { showToast(err.message || 'Şifre güncellenemedi.', 'danger'); }
    finally { setSavingPassword(false); }
  };

  const initials = `${(name?.[0] || 'M')}${(surname?.[0] || 'Ü')}`.toUpperCase();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <Text style={styles.userName}>{name || surname ? `${name} ${surname}`.trim() : phone}</Text>
          <Text style={styles.userPhone}>{phone}</Text>
        </View>

        {/* Profile Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profil Bilgileri</Text>

          <Text style={styles.label}>Ad</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Adınız" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Soyad</Text>
          <TextInput style={styles.input} value={surname} onChangeText={setSurname} placeholder="Soyadınız" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Telefon</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="05XX" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />

          <Text style={styles.label}>E-posta</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>Adres</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Adresiniz" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Şehir</Text>
          <Pressable style={styles.picker} onPress={() => { setShowCityPicker(!showCityPicker); setShowDistrictPicker(false); }}>
            <Text style={profileCity ? styles.pickerText : styles.pickerPlaceholder}>{profileCity || 'Şehir seçin'}</Text>
          </Pressable>
          {showCityPicker && (
            <ScrollView style={styles.pickerList} nestedScrollEnabled>
              {cities.map(c => (
                <Pressable key={c} style={styles.pickerItem} onPress={() => { setProfileCity(c); setProfileDistrict(''); setShowCityPicker(false); }}>
                  <Text style={styles.pickerItemText}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {profileCity ? (
            <>
              <Text style={[styles.label, { marginTop: 8 }]}>İlçe</Text>
              <Pressable style={styles.picker} onPress={() => { setShowDistrictPicker(!showDistrictPicker); setShowCityPicker(false); }}>
                <Text style={profileDistrict ? styles.pickerText : styles.pickerPlaceholder}>{profileDistrict || 'İlçe seçin'}</Text>
              </Pressable>
              {showDistrictPicker && (
                <ScrollView style={styles.pickerList} nestedScrollEnabled>
                  {districts.map(d => (
                    <Pressable key={d} style={styles.pickerItem} onPress={() => { setProfileDistrict(d); setShowDistrictPicker(false); }}>
                      <Text style={styles.pickerItemText}>{d}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </>
          ) : null}

          <Pressable style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSaveProfile} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Profili Kaydet</Text>}
          </Pressable>
        </View>

        {/* Password */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Şifre Değiştir</Text>
          <Text style={styles.label}>Eski Şifre</Text>
          <TextInput style={styles.input} value={oldPassword} onChangeText={setOldPassword} placeholder="Mevcut şifreniz" placeholderTextColor={Colors.textMuted} secureTextEntry />
          <Text style={styles.label}>Yeni Şifre</Text>
          <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="En az 6 karakter" placeholderTextColor={Colors.textMuted} secureTextEntry />
          <Pressable style={[styles.saveBtn, styles.saveBtnOutline, savingPassword && { opacity: 0.7 }]} onPress={handleChangePassword} disabled={savingPassword}>
            {savingPassword ? <ActivityIndicator color={Colors.primary} size="small" /> : <Text style={[styles.saveBtnText, { color: Colors.primary }]}>Şifreyi Güncelle</Text>}
          </Pressable>
        </View>

        {/* Shortcuts */}
        <View style={styles.card}>
          <Pressable style={styles.menuItem} onPress={() => navigation.navigate('Favorites')}>
            <Text style={styles.menuIcon}>❤️</Text>
            <Text style={styles.menuText}>Favori Berberlerim</Text>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>🚪 Çıkış Yap</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 20 },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 26, fontWeight: '800', color: '#fff' },
  userName: { fontSize: 20, fontWeight: '700', color: Colors.text },
  userPhone: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  card: { marginHorizontal: 20, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.inputBg, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.text, marginBottom: 12 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.inputBg, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  pickerText: { fontSize: 15, color: Colors.text },
  pickerPlaceholder: { fontSize: 15, color: Colors.textMuted },
  pickerList: { maxHeight: 180, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  pickerItemText: { fontSize: 14, color: Colors.text },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  saveBtnOutline: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primary },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuIcon: { fontSize: 20, marginRight: 12 },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  menuChevron: { fontSize: 20, color: Colors.textMuted },
  logoutBtn: { marginHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.danger, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.dangerBg },
  logoutText: { fontSize: 15, fontWeight: '600', color: Colors.danger },
});
