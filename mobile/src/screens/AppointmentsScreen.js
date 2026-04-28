import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyAppointments, cancelAppointment, rescheduleAppointment, rescheduleResponse, sendBarberReminder, fetchAvailableSlots } from '../services/bookingService';
import { onAppointmentUpdate, emitCustomerLogin } from '../services/socketService';
import AppointmentCard from '../components/AppointmentCard';
import DateStrip from '../components/DateStrip';
import SlotPicker from '../components/SlotPicker';
import { showToast } from '../components/Toast';

const toLocalDate = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}`; };

export default function AppointmentsScreen() {
  const { user, customerId } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState('');
  const [reminderLoadingId, setReminderLoadingId] = useState('');
  const [rescheduleLoadingId, setRescheduleLoadingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSlots, setEditSlots] = useState([]);
  const [editSlotId, setEditSlotId] = useState('');
  const [loadingEditSlots, setLoadingEditSlots] = useState(false);
  const [savingEditId, setSavingEditId] = useState('');

  const displayName = useMemo(() => `${user?.name || ''} ${user?.surname || ''}`.trim(), [user]);

  const loadAppointments = useCallback(async () => {
    if (!customerId) { setLoading(false); return; }
    try {
      const list = await fetchMyAppointments(customerId);
      const sorted = [...list].sort((a, b) => {
        const ad = `${a.date || ''} ${a.time || ''}`;
        const bd = `${b.date || ''} ${b.time || ''}`;
        return bd.localeCompare(ad);
      });
      setAppointments(sorted);
    } catch { setAppointments([]); }
    finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  // Socket
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
    await loadAppointments();
    setRefreshing(false);
  }, [loadAppointments]);

  const handleCancel = async (apt) => {
    setCancellingId(apt._id);
    try {
      const res = await cancelAppointment(customerId, apt._id);
      setAppointments(prev => prev.map(a => a._id === apt._id ? { ...a, ...res.appointment } : a));
      showToast('Randevu iptal edildi.', 'success');
    } catch (err) { showToast(err.message || 'İptal edilemedi.', 'danger'); }
    finally { setCancellingId(''); }
  };

  const handleReminder = async (apt) => {
    setReminderLoadingId(apt._id);
    try {
      await sendBarberReminder(apt.slotId, { customerId, customerName: displayName });
      setAppointments(prev => prev.map(a => a._id === apt._id ? { ...a, reminderSentAt: new Date().toISOString() } : a));
      showToast('Berbere hatırlatma gönderildi.', 'success');
    } catch (err) { showToast(err.message || 'Hatırlatma gönderilemedi.', 'danger'); }
    finally { setReminderLoadingId(''); }
  };

  const handleRescheduleResponse = async (apt, decision) => {
    setRescheduleLoadingId(apt._id);
    try {
      const res = await rescheduleResponse(customerId, apt._id, decision);
      setAppointments(prev => prev.map(a => a._id === apt._id ? { ...a, ...res.appointment } : a));
      showToast(decision === 'accept' ? 'Yeni saati kabul ettiniz.' : 'Yeni saat önerisini reddettiniz.', 'success');
    } catch (err) { showToast(err.message || 'Yanıtlanamadı.', 'danger'); }
    finally { setRescheduleLoadingId(''); }
  };

  // Edit (reschedule) flow
  const handleEdit = async (apt) => {
    const defaultDate = apt.date || toLocalDate(new Date());
    setEditingId(apt._id);
    setEditDate(defaultDate);
    setEditSlotId('');
    setLoadingEditSlots(true);
    try {
      const slots = await fetchAvailableSlots(apt.barberId, defaultDate, '__owner__');
      setEditSlots(slots);
      // Pre-select nearest slot
      if (slots.length > 0 && apt.time) {
        const refMin = (() => { const [h, m] = apt.time.split(':').map(Number); return h * 60 + m; })();
        let nearest = slots[0];
        let diff = Infinity;
        slots.forEach(s => {
          const [h, m] = String(s.time || '').split(':').map(Number);
          const d = Math.abs(h * 60 + m - refMin);
          if (d < diff) { diff = d; nearest = s; }
        });
        setEditSlotId(nearest._id || '');
      }
    } catch { setEditSlots([]); }
    finally { setLoadingEditSlots(false); }
  };

  const handleEditDateChange = async (dateVal) => {
    setEditDate(dateVal);
    setEditSlotId('');
    if (!editingId) return;
    const apt = appointments.find(a => a._id === editingId);
    if (!apt) return;
    setLoadingEditSlots(true);
    try {
      const slots = await fetchAvailableSlots(apt.barberId, dateVal, '__owner__');
      setEditSlots(slots);
    } catch { setEditSlots([]); }
    finally { setLoadingEditSlots(false); }
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editSlotId) { showToast('Yeni bir saat seçin.', 'danger'); return; }
    setSavingEditId(editingId);
    try {
      const res = await rescheduleAppointment(customerId, editingId, editSlotId);
      setAppointments(prev => prev.map(a => a._id === editingId ? { ...a, ...res.appointment } : a));
      setEditingId('');
      setEditSlots([]);
      setEditSlotId('');
      showToast('Randevu güncellendi.', 'success');
    } catch (err) { showToast(err.message || 'Güncellenemedi.', 'danger'); }
    finally { setSavingEditId(''); }
  };

  const editDays = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return { value: toLocalDate(d), dayName: new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(d), monthName: new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(d), dayNumber: new Intl.DateTimeFormat('tr-TR', { day: '2-digit' }).format(d) };
    });
  }, []);

  // Separate active vs past
  const activeApts = useMemo(() => appointments.filter(a => !['cancelled', 'reddedildi', 'completed', 'tamamlandı'].includes(String(a.status || '').toLowerCase())), [appointments]);
  const pastApts = useMemo(() => appointments.filter(a => ['cancelled', 'reddedildi', 'completed', 'tamamlandı'].includes(String(a.status || '').toLowerCase())), [appointments]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      <View style={styles.header}>
        <Text style={styles.title}>📅 Randevularım</Text>
        <Text style={styles.subtitle}>{appointments.length} randevu</Text>
      </View>

      {appointments.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyText}>Henüz randevu kaydınız yok.</Text></View>
      ) : (
        <>
          {activeApts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🕐 Aktif Randevular ({activeApts.length})</Text>
              {activeApts.map(apt => (
                <View key={apt._id}>
                  <AppointmentCard
                    appointment={apt}
                    onCancel={handleCancel}
                    onEdit={handleEdit}
                    onReminder={handleReminder}
                    onRescheduleResponse={handleRescheduleResponse}
                    cancelLoading={cancellingId === apt._id}
                    reminderLoading={reminderLoadingId === apt._id}
                    rescheduleLoading={rescheduleLoadingId === apt._id}
                  />
                  {editingId === apt._id && (
                    <View style={styles.editBox}>
                      <Text style={styles.editTitle}>✏️ Saat Değiştir</Text>
                      <DateStrip days={editDays} selectedDate={editDate} onSelect={handleEditDateChange} />
                      <View style={{ marginTop: 12 }}>
                        {loadingEditSlots ? <ActivityIndicator color={Colors.primary} /> :
                          <SlotPicker slots={editSlots} selectedSlotId={editSlotId} onSelect={(s) => setEditSlotId(s._id)} />
                        }
                      </View>
                      <View style={styles.editActions}>
                        <Pressable style={styles.editCancel} onPress={() => { setEditingId(''); setEditSlots([]); }}>
                          <Text style={styles.editCancelText}>Vazgeç</Text>
                        </Pressable>
                        <Pressable style={[styles.editSave, (savingEditId === apt._id) && { opacity: 0.7 }]} onPress={handleSaveEdit} disabled={savingEditId === apt._id}>
                          <Text style={styles.editSaveText}>{savingEditId === apt._id ? '...' : '✓ Kaydet'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {pastApts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 Geçmiş ({pastApts.length})</Text>
              {pastApts.map(apt => <AppointmentCard key={apt._id} appointment={apt} />)}
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  emptyCard: { marginHorizontal: 20, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  editBox: { backgroundColor: Colors.surfaceAlt, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  editTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  editCancel: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  editCancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  editSave: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center' },
  editSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
