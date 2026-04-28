import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { fetchCities, fetchDistricts, fetchBarbersByDistrict, fetchBarbers } from '../services/barberService';
import { fetchMyAppointments, fetchInvoices } from '../services/bookingService';
import { fetchFavorites } from '../services/favoriteService';
import { getLocationPreference, saveLocationPreference } from '../services/storageService';
import { onAppointmentUpdate, emitCustomerLogin } from '../services/socketService';
import BarberCard from '../components/BarberCard';
import { showToast } from '../components/Toast';

export default function HomeScreen({ navigation }) {
  const { user, customerId } = useAuth();
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [barbers, setBarbers] = useState([]);
  const [loadingBarbers, setLoadingBarbers] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);

  const displayName = useMemo(() => {
    const n = String(user?.name || '').trim();
    const s = String(user?.surname || '').trim();
    const full = `${n} ${s}`.trim();
    return full || user?.phone || 'Müşteri';
  }, [user]);

  const summaryCards = useMemo(() => [
    { label: 'Randevu', value: appointments.length, icon: '📅', tone: Colors.primary },
    { label: 'Favori', value: favorites.length, icon: '❤️', tone: Colors.danger },
    { label: 'Fatura', value: invoices.length, icon: '🧾', tone: Colors.warning },
  ], [appointments.length, favorites.length, invoices.length]);

  // Şehirleri yükle + tercih restore
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cityList = await fetchCities();
        if (!active) return;
        setCities(cityList);
        const pref = await getLocationPreference();
        if (pref?.city && cityList.includes(pref.city)) {
          setSelectedCity(pref.city);
          setSelectedDistrict(pref.district || '');
        } else if (user?.city && cityList.includes(user.city)) {
          setSelectedCity(user.city);
          setSelectedDistrict(user.district || '');
        }
      } catch { /* silent */ }
    })();
    return () => { active = false; };
  }, []);

  // İlçeleri yükle
  useEffect(() => {
    if (!selectedCity) { setDistricts([]); setSelectedDistrict(''); return; }
    let active = true;
    (async () => {
      try {
        const list = await fetchDistricts(selectedCity);
        if (active) setDistricts(list);
      } catch { if (active) setDistricts([]); }
    })();
    return () => { active = false; };
  }, [selectedCity]);

  // Konum tercihini kaydet
  useEffect(() => {
    if (selectedCity || selectedDistrict) saveLocationPreference(selectedCity, selectedDistrict);
  }, [selectedCity, selectedDistrict]);

  // Berberleri yükle
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingBarbers(true);
      try {
        const list = (selectedCity && selectedDistrict)
          ? await fetchBarbersByDistrict(selectedCity, selectedDistrict)
          : await fetchBarbers();
        if (active) setBarbers(list.slice(0, 10));
      } catch { if (active) setBarbers([]); }
      finally { if (active) setLoadingBarbers(false); }
    })();
    return () => { active = false; };
  }, [selectedCity, selectedDistrict]);

  // Randevu, favori, fatura yükle
  const loadDashboard = useCallback(async () => {
    if (!customerId) return;
    try {
      const [apts, favs, invs] = await Promise.all([
        fetchMyAppointments(customerId).catch(() => []),
        fetchFavorites(customerId).catch(() => []),
        fetchInvoices(customerId).catch(() => []),
      ]);
      setAppointments(apts);
      setFavorites(favs);
      setInvoices(invs);
    } catch { /* silent */ }
  }, [customerId]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Socket.io
  useEffect(() => {
    if (!customerId) return;
    emitCustomerLogin(customerId);
    const unsub = onAppointmentUpdate((data) => {
      setAppointments(prev => prev.map(a => {
        const match = (a.slotId && a.slotId === data.slotId) || (a.date === data.date && a.time === data.time);
        if (match) return { ...a, status: data.status || a.status, date: data.date || a.date, time: data.time || a.time, assignedMaster: data.assignedMaster || a.assignedMaster, rescheduleApproval: data.rescheduleApproval || a.rescheduleApproval };
        return a;
      }));
      showToast('Randevu durumu güncellendi', 'info');
    });
    return unsub;
  }, [customerId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }, [loadDashboard]);

  const handleBarberPress = (barber) => {
    navigation.navigate('Booking', { prefill: { city: barber.city, district: barber.district, barberId: barber._id } });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.greeting}>Merhaba, {displayName} 👋</Text>
        <Text style={styles.greetingSub}>Bugün bir randevu oluşturmak ister misin?</Text>
      </View>

      {/* Summary Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
        {summaryCards.map((c) => (
          <View key={c.label} style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>{c.icon}</Text>
            <Text style={[styles.summaryValue, { color: c.tone }]}>{c.value}</Text>
            <Text style={styles.summaryLabel}>{c.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Location Filter */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Konum Filtresi</Text>
        <Pressable style={styles.picker} onPress={() => setShowCityPicker(!showCityPicker)}>
          <Text style={selectedCity ? styles.pickerText : styles.pickerPlaceholder}>{selectedCity || 'Şehir seçin'}</Text>
          <Text style={styles.pickerChevron}>▾</Text>
        </Pressable>
        {showCityPicker && (
          <ScrollView style={styles.pickerList} nestedScrollEnabled>
            {cities.map(c => (
              <Pressable key={c} style={styles.pickerItem} onPress={() => { setSelectedCity(c); setSelectedDistrict(''); setShowCityPicker(false); setShowDistrictPicker(false); }}>
                <Text style={[styles.pickerItemText, selectedCity === c && { color: Colors.primary, fontWeight: '700' }]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {selectedCity ? (
          <>
            <Pressable style={[styles.picker, { marginTop: 8 }]} onPress={() => setShowDistrictPicker(!showDistrictPicker)}>
              <Text style={selectedDistrict ? styles.pickerText : styles.pickerPlaceholder}>{selectedDistrict || 'İlçe seçin'}</Text>
              <Text style={styles.pickerChevron}>▾</Text>
            </Pressable>
            {showDistrictPicker && (
              <ScrollView style={styles.pickerList} nestedScrollEnabled>
                {districts.map(d => (
                  <Pressable key={d} style={styles.pickerItem} onPress={() => { setSelectedDistrict(d); setShowDistrictPicker(false); }}>
                    <Text style={[styles.pickerItemText, selectedDistrict === d && { color: Colors.primary, fontWeight: '700' }]}>{d}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>
        ) : null}
      </View>

      {/* Barbers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {selectedCity && selectedDistrict ? `✂️ ${selectedCity} / ${selectedDistrict} Berberleri` : '✂️ Önerilen Berberler'}
        </Text>
        {loadingBarbers ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
        ) : barbers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Bu bölgede henüz berber bulunamadı.</Text>
          </View>
        ) : (
          barbers.map(b => <BarberCard key={b._id} barber={b} onPress={handleBarberPress} />)
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 20 },
  headerSection: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  greeting: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  greetingSub: { fontSize: 14, color: Colors.textSecondary },
  summaryRow: { paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  summaryCard: { width: 110, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, alignItems: 'center' },
  summaryIcon: { fontSize: 24, marginBottom: 6 },
  summaryValue: { fontSize: 24, fontWeight: '800' },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12 },
  pickerText: { fontSize: 15, color: Colors.text },
  pickerPlaceholder: { fontSize: 15, color: Colors.textMuted },
  pickerChevron: { fontSize: 14, color: Colors.textMuted },
  pickerList: { maxHeight: 200, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  pickerItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  pickerItemText: { fontSize: 15, color: Colors.text },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.textMuted },
});
