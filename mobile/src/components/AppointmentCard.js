import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';

function getStatusMeta(status, appointment) {
  const s = String(status || '').toLowerCase();
  if (s === 'saat değişikliği müşteri onayı bekleniyor') return { tone: Colors.warning, bg: Colors.warningBg, icon: '📝', label: 'Saat Onayın Bekleniyor' };
  if (s === 'saat değişikliği berber onayı bekleniyor') return { tone: Colors.statusPending, bg: Colors.statusPendingBg, icon: '🕒', label: 'Berber Onayı Bekleniyor' };
  if (s === 'confirmed') return { tone: Colors.success, bg: Colors.successBg, icon: '✅', label: 'Onaylandı' };
  if (s === 'completed' || s === 'tamamlandı') return { tone: Colors.statusCompleted, bg: Colors.statusCompletedBg, icon: '✅', label: 'Tamamlandı' };
  if (s === 'cancelled' || s === 'reddedildi') {
    const r = String(appointment?.cancelReason || '').toLowerCase();
    const label = r.includes('müşteri') ? 'İptal Ettin' : r.includes('berber') ? 'Berber İptal Etti' : 'İptal';
    return { tone: Colors.danger, bg: Colors.dangerBg, icon: '⛔', label };
  }
  if (['pending', 'booked', 'randevu alındı'].includes(s)) return { tone: Colors.statusPending, bg: Colors.statusPendingBg, icon: '🕒', label: 'Onay Bekleniyor' };
  return { tone: Colors.textMuted, bg: Colors.surfaceAlt, icon: 'ℹ️', label: status || 'Bilgi' };
}

function getMasterName(apt) {
  const raw = apt?.assignedMaster;
  if (raw && typeof raw === 'object') {
    const n = String(raw.name || raw.username || raw.fullName || '').trim();
    if (n) return n;
  }
  return String(apt?.assignedMasterName || apt?.masterName || apt?.barberName || '').trim() || '';
}

function getPrice(apt) {
  for (const v of [apt?.service?.price, apt?.servicePrice, apt?.price, apt?.payment?.amount]) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export default function AppointmentCard({ appointment, onCancel, onEdit, onReminder, onRescheduleResponse, cancelLoading, editLoading, reminderLoading, rescheduleLoading }) {
  const apt = appointment;
  const sm = getStatusMeta(apt?.status, apt);
  const masterName = getMasterName(apt);
  const price = getPrice(apt);
  const serviceName = apt?.service?.name || 'Belirtilmedi';

  const isPending = ['pending', 'booked', 'randevu alındı'].includes(String(apt?.status || '').toLowerCase());
  const canCancel = isPending && String(apt?.status || '').toLowerCase() !== 'cancelled';
  const canEdit = isPending && apt?.slotId && apt?.barberId;
  const canRemind = isPending && !apt?.reminderSentAt && apt?.createdAt && (new Date(apt.createdAt).getTime() <= Date.now() - 5 * 60 * 1000);
  const canRescheduleRespond = String(apt?.rescheduleApproval?.phase || '') === 'awaiting_customer';

  return (
    <View style={[styles.card, { borderLeftColor: sm.tone }]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: sm.bg }]}>
          <Text style={styles.badgeIcon}>{sm.icon}</Text>
          <Text style={[styles.badgeLabel, { color: sm.tone }]}>{sm.label}</Text>
        </View>
      </View>

      <Text style={styles.barberName}>{apt?.barberSalonName || apt?.barberName || 'Berber'}</Text>
      {masterName ? <Text style={styles.masterName}>Usta: {masterName}</Text> : null}
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>📅 {apt?.date || '-'}</Text>
        <Text style={styles.detailLabel}>🕐 {apt?.time || '-'}</Text>
      </View>
      <Text style={styles.detailLabel}>✂️ {serviceName}</Text>
      {price > 0 && <Text style={styles.price}>₺{price.toLocaleString('tr-TR')}</Text>}

      {canRescheduleRespond && (
        <View style={styles.rescheduleBox}>
          <Text style={styles.rescheduleTitle}>📝 Berber yeni saat önerdi:</Text>
          <Text style={styles.rescheduleInfo}>
            {apt.rescheduleApproval?.proposedDate} - {apt.rescheduleApproval?.proposedTime}
          </Text>
          <View style={styles.actionRow}>
            <Pressable style={[styles.btn, styles.btnSuccess]} onPress={() => onRescheduleResponse?.(apt, 'accept')} disabled={rescheduleLoading}>
              <Text style={styles.btnTextWhite}>{rescheduleLoading ? '...' : '✓ Kabul Et'}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnDanger]} onPress={() => onRescheduleResponse?.(apt, 'reject')} disabled={rescheduleLoading}>
              <Text style={styles.btnTextWhite}>{rescheduleLoading ? '...' : '✗ Reddet'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.actionRow}>
        {canRemind && (
          <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => onReminder?.(apt)} disabled={reminderLoading}>
            <Text style={styles.btnTextOutline}>{reminderLoading ? '...' : '🔔 Hatırlat'}</Text>
          </Pressable>
        )}
        {canEdit && (
          <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => onEdit?.(apt)} disabled={editLoading}>
            <Text style={styles.btnTextOutline}>{editLoading ? '...' : '✏️ Düzenle'}</Text>
          </Pressable>
        )}
        {canCancel && (
          <Pressable style={[styles.btn, styles.btnDangerOutline]} onPress={() => onCancel?.(apt)} disabled={cancelLoading}>
            <Text style={[styles.btnTextOutline, { color: Colors.danger }]}>{cancelLoading ? '...' : '✗ İptal'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, padding: 14, marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeIcon: { fontSize: 12, marginRight: 4 },
  badgeLabel: { fontSize: 12, fontWeight: '600' },
  barberName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  masterName: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  detailRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  detailLabel: { fontSize: 13, color: Colors.textSecondary },
  price: { fontSize: 15, fontWeight: '700', color: Colors.primary, marginTop: 4 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  btnDangerOutline: { borderWidth: 1, borderColor: Colors.danger, backgroundColor: Colors.surface },
  btnSuccess: { backgroundColor: Colors.success },
  btnDanger: { backgroundColor: Colors.danger },
  btnTextWhite: { fontSize: 13, fontWeight: '600', color: '#fff' },
  btnTextOutline: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  rescheduleBox: { backgroundColor: Colors.warningBg, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: Colors.warning },
  rescheduleTitle: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  rescheduleInfo: { fontSize: 14, fontWeight: '700', color: Colors.warning, marginBottom: 8 },
});
