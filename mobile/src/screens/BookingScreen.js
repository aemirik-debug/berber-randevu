import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { fetchCities, fetchDistricts, fetchBarbersByDistrict, fetchBarbers } from '../services/barberService';
import { fetchAvailableSlots, bookSlot } from '../services/bookingService';
import BarberCard from '../components/BarberCard';
import DateStrip from '../components/DateStrip';
import SlotPicker from '../components/SlotPicker';
import ServicePicker from '../components/ServicePicker';
import { showToast } from '../components/Toast';

const WEEK_DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const OWNER_SCOPE = '__owner__';

const toLocalDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const parseClockToMin = (v) => {
  const [h, m] = String(v || '').split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

export default function BookingScreen({ navigation, route }) {
  const { user, customerId } = useAuth();
  const prefill = route?.params?.prefill || null;

  const [step, setStep] = useState(1);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [loadingBarbers, setLoadingBarbers] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedMasterId, setSelectedMasterId] = useState(OWNER_SCOPE);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [showMasterPicker, setShowMasterPicker] = useState(false);

  const nowTick = Date.now();
  const today = useMemo(() => toLocalDate(new Date(nowTick)), []);
  const nowTime = useMemo(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }, []);

  // Load cities
  useEffect(() => {
    fetchCities().then(setCities).catch(() => setCities([]));
  }, []);

  // Load districts
  useEffect(() => {
    if (!city) { setDistricts([]); return; }
    fetchDistricts(city).then(setDistricts).catch(() => setDistricts([]));
  }, [city]);

  // Load barbers
  useEffect(() => {
    if (!city || !district) return;
    let active = true;
    setLoadingBarbers(true);
    const load = city && district ? fetchBarbersByDistrict(city, district) : fetchBarbers();
    load.then(list => { if (active) setBarbers(list); }).catch(() => { if (active) setBarbers([]); }).finally(() => { if (active) setLoadingBarbers(false); });
    return () => { active = false; };
  }, [city, district]);

  // Prefill from HomeScreen
  useEffect(() => {
    if (!prefill) return;
    if (prefill.city) setCity(prefill.city);
    if (prefill.district) setDistrict(prefill.district);
    if (prefill.barberId) {
      // Wait for barbers to load then select
      const timer = setTimeout(() => {
        setBarbers(prev => {
          const found = prev.find(b => String(b._id) === String(prefill.barberId));
          if (found) { setSelectedBarber(found); setStep(3); }
          return prev;
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [prefill]);

  // Working hours check
  const isBarberOpenOn = useCallback((barber, dateVal) => {
    if (!barber?.workingHours) return true;
    const d = new Date(`${dateVal}T00:00:00`);
    if (isNaN(d.getTime())) return true;
    const dayKey = WEEK_DAY_KEYS[d.getDay()];
    const ds = barber.workingHours[dayKey];
    if (!ds || ds.isOpen !== true) return false;
    const open = parseClockToMin(ds.open);
    const close = parseClockToMin(ds.close);
    return open !== null && close !== null && close > open;
  }, []);

  // Calendar days
  const calendarDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    // Check if today is past closing for this barber
    if (selectedBarber?.workingHours) {
      const dayKey = WEEK_DAY_KEYS[new Date().getDay()];
      const ds = selectedBarber.workingHours[dayKey];
      if (ds && ds.isOpen === true) {
        const close = parseClockToMin(ds.close);
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        if (close !== null && nowMin >= close) start.setDate(start.getDate() + 1);
      } else {
        start.setDate(start.getDate() + 1);
      }
    }

    const days = [];
    let cursor = new Date(start);
    let guard = 0;
    while (days.length < 7 && guard < 21) {
      if (isBarberOpenOn(selectedBarber, toLocalDate(cursor))) days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    if (days.length === 0) days.push(new Date(start));

    return days.map(d => ({
      value: toLocalDate(d),
      dayName: new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(d),
      monthName: new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(d),
      dayNumber: new Intl.DateTimeFormat('tr-TR', { day: '2-digit' }).format(d),
    }));
  }, [selectedBarber, isBarberOpenOn]);

  // Load slots
  useEffect(() => {
    if (!selectedBarber || !selectedDate) { setAvailableSlots([]); return; }
    let active = true;
    setLoadingSlots(true);
    fetchAvailableSlots(selectedBarber._id, selectedDate, selectedMasterId)
      .then(slots => {
        if (!active) return;
        const mapped = slots.map(s => ({
          ...s,
          isPastSlot: selectedDate < today || (selectedDate === today && String(s.time || '').slice(0, 5) <= nowTime),
        }));
        setAvailableSlots(mapped);
      })
      .catch(() => { if (active) setAvailableSlots([]); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [selectedBarber, selectedDate, selectedMasterId, today, nowTime]);

  const serviceList = selectedBarber?.services || [];
  const activeMasters = useMemo(() => (selectedBarber?.masters || []).filter(m => m && m.isActive !== false), [selectedBarber]);
  const ownerName = useMemo(() => String(selectedBarber?.name || selectedBarber?.salonName || 'İşletme Sahibi').trim(), [selectedBarber]);
  const selectedPrice = Number(selectedService?.price || 0);

  const handleBook = async () => {
    if (!selectedSlot || !selectedService || !selectedBarber) return;
    setSubmitting(true);
    try {
      await bookSlot(selectedSlot._id, {
        customerId: customerId || undefined,
        customerPhone: user?.phone || undefined,
        customerName: `${user?.name || ''} ${user?.surname || ''}`.trim(),
        barberId: selectedBarber._id,
        date: selectedDate,
        time: selectedSlot.time,
        serviceId: selectedService._id,
        service: selectedService.name,
        price: selectedPrice,
        assignedMasterId: selectedMasterId === OWNER_SCOPE ? undefined : selectedMasterId,
      });
      showToast('Randevunuz oluşturuldu! Berberin onayı bekleniyor.', 'success');
      navigation.goBack();
    } catch (err) {
      showToast(err.message || 'Randevu oluşturulamadı.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Step indicators
  const steps = [{ id: 1, label: 'Konum' }, { id: 2, label: 'Berber' }, { id: 3, label: 'Detay' }, { id: 4, label: 'Onay' }];
  const currentStep = !city || !district ? 1 : !selectedBarber ? 2 : !selectedService || !selectedDate || !selectedSlot ? 3 : 4;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>💈 Randevu Oluştur</Text>
          <Text style={styles.subtitle}>2 dakikada randevunu planla</Text>
        </View>

        {/* Stepper */}
        <View style={styles.stepper}>
          {steps.map(s => (
            <View key={s.id} style={[styles.stepItem, currentStep >= s.id && styles.stepItemActive]}>
              <View style={[styles.stepDot, currentStep >= s.id && styles.stepDotActive]}>
                <Text style={[styles.stepNum, currentStep >= s.id && styles.stepNumActive]}>{s.id}</Text>
              </View>
              <Text style={[styles.stepLabel, currentStep >= s.id && styles.stepLabelActive]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* STEP 1: Konum */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Konumunu Seç</Text>
          <Pressable style={styles.picker} onPress={() => { setShowCityPicker(!showCityPicker); setShowDistrictPicker(false); }}>
            <Text style={city ? styles.pickerText : styles.pickerPlaceholder}>{city || 'Şehir seçin'}</Text>
            <Text style={styles.pickerChevron}>▾</Text>
          </Pressable>
          {showCityPicker && (
            <ScrollView style={styles.pickerList} nestedScrollEnabled>
              {cities.map(c => (
                <Pressable key={c} style={styles.pickerItem} onPress={() => { setCity(c); setDistrict(''); setSelectedBarber(null); setSelectedService(null); setSelectedSlot(null); setShowCityPicker(false); }}>
                  <Text style={[styles.pickerItemText, city === c && { color: Colors.primary, fontWeight: '700' }]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {city ? (
            <>
              <Pressable style={[styles.picker, { marginTop: 8 }]} onPress={() => { setShowDistrictPicker(!showDistrictPicker); setShowCityPicker(false); }}>
                <Text style={district ? styles.pickerText : styles.pickerPlaceholder}>{district || 'İlçe seçin'}</Text>
                <Text style={styles.pickerChevron}>▾</Text>
              </Pressable>
              {showDistrictPicker && (
                <ScrollView style={styles.pickerList} nestedScrollEnabled>
                  {districts.map(d => (
                    <Pressable key={d} style={styles.pickerItem} onPress={() => { setDistrict(d); setSelectedBarber(null); setSelectedService(null); setSelectedSlot(null); setShowDistrictPicker(false); }}>
                      <Text style={[styles.pickerItemText, district === d && { color: Colors.primary, fontWeight: '700' }]}>{d}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </>
          ) : null}
        </View>

        {/* STEP 2: Berber */}
        {city && district ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Berberini Seç</Text>
            {loadingBarbers ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} /> :
              barbers.length === 0 ? <Text style={styles.emptyText}>Bu ilçede berber bulunamadı.</Text> :
                barbers.map(b => (
                  <BarberCard key={b._id} barber={b} selected={selectedBarber?._id === b._id} onPress={() => {
                    setSelectedBarber(b); setSelectedService(null); setSelectedMasterId(OWNER_SCOPE); setSelectedDate(''); setSelectedSlot(null); setAvailableSlots([]);
                  }} />
                ))
            }
          </View>
        ) : null}

        {/* STEP 3: Hizmet + Tarih + Saat */}
        {selectedBarber ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Hizmet ve Saat Seçimi</Text>
            <Text style={styles.inlineTitle}>{selectedBarber.name || selectedBarber.salonName} için randevu</Text>

            {/* Hizmet */}
            <Text style={styles.label}>Hizmet Seçin</Text>
            <ServicePicker services={serviceList} selectedServiceId={selectedService?._id} onSelect={setSelectedService} />

            {/* Usta */}
            <Text style={[styles.label, { marginTop: 16 }]}>İşletme / Usta</Text>
            <Pressable style={styles.picker} onPress={() => setShowMasterPicker(!showMasterPicker)}>
              <Text style={styles.pickerText}>🧑‍🔧 {selectedMasterId === OWNER_SCOPE ? `${ownerName} (İşletme Sahibi)` : activeMasters.find(m => String(m._id) === selectedMasterId)?.name || ownerName}</Text>
              <Text style={styles.pickerChevron}>▾</Text>
            </Pressable>
            {showMasterPicker && (
              <ScrollView style={styles.pickerList} nestedScrollEnabled>
                <Pressable style={styles.pickerItem} onPress={() => { setSelectedMasterId(OWNER_SCOPE); setShowMasterPicker(false); }}>
                  <Text style={[styles.pickerItemText, selectedMasterId === OWNER_SCOPE && { color: Colors.primary, fontWeight: '700' }]}>🏪 {ownerName} (İşletme Sahibi)</Text>
                </Pressable>
                {activeMasters.map(m => (
                  <Pressable key={m._id} style={styles.pickerItem} onPress={() => { setSelectedMasterId(String(m._id)); setShowMasterPicker(false); }}>
                    <Text style={[styles.pickerItemText, selectedMasterId === String(m._id) && { color: Colors.primary, fontWeight: '700' }]}>🧑‍🔧 {m.name}{m.specialty ? ` (${m.specialty})` : ''}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Tarih */}
            <Text style={[styles.label, { marginTop: 16 }]}>📅 Tarih Seçin</Text>
            <DateStrip days={calendarDays} selectedDate={selectedDate} onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }} />

            {/* Saat */}
            {selectedDate ? (
              <>
                <Text style={[styles.label, { marginTop: 16 }]}>🕐 Saat Seçin</Text>
                {loadingSlots ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} /> :
                  <SlotPicker slots={availableSlots} selectedSlotId={selectedSlot?._id} onSelect={setSelectedSlot} />
                }
              </>
            ) : null}

            {/* Seçim özeti */}
            {selectedService && (
              <View style={styles.selectionSummary}>
                <Text style={styles.summaryText}>{selectedService.name} · ₺{selectedPrice} · {selectedService.duration || 0} dk</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* STEP 4: Onay */}
        {selectedBarber && selectedService && selectedDate && selectedSlot ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Randevu Özeti</Text>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmRow}>✂️ Berber: {selectedBarber.salonName || selectedBarber.name}</Text>
              <Text style={styles.confirmRow}>🧑‍🔧 Usta: {selectedMasterId === OWNER_SCOPE ? ownerName : activeMasters.find(m => String(m._id) === selectedMasterId)?.name || ownerName}</Text>
              <Text style={styles.confirmRow}>📋 Hizmet: {selectedService.name}</Text>
              <Text style={styles.confirmRow}>📅 Tarih: {selectedDate}</Text>
              <Text style={styles.confirmRow}>🕐 Saat: {String(selectedSlot.time || '').slice(0, 5)}</Text>
              <Text style={styles.confirmRow}>💰 Fiyat: ₺{selectedPrice}</Text>
            </View>
            <Pressable style={[styles.bookBtn, submitting && { opacity: 0.7 }]} onPress={handleBook} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.bookBtnText}>✓ Randevu Oluştur</Text>}
            </Pressable>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingBottom: 40 },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  stepper: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 4 },
  stepItem: { flex: 1, alignItems: 'center' },
  stepItemActive: {},
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.skeleton, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stepDotActive: { backgroundColor: Colors.primary },
  stepNum: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: Colors.textMuted },
  stepLabelActive: { color: Colors.primary, fontWeight: '600' },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  inlineTitle: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12 },
  pickerText: { fontSize: 15, color: Colors.text, flex: 1 },
  pickerPlaceholder: { fontSize: 15, color: Colors.textMuted, flex: 1 },
  pickerChevron: { fontSize: 14, color: Colors.textMuted },
  pickerList: { maxHeight: 200, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  pickerItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  pickerItemText: { fontSize: 15, color: Colors.text },
  selectionSummary: { marginTop: 12, backgroundColor: Colors.primaryLight, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.primary },
  summaryText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  confirmCard: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 },
  confirmRow: { fontSize: 14, color: Colors.text, marginBottom: 6 },
  bookBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  bookBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 20 },
});
