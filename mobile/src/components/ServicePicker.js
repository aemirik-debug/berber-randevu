import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';

export default function ServicePicker({ services, selectedServiceId, onSelect }) {
  if (!services || services.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Bu salonda henüz tanımlı hizmet bulunmuyor.</Text>
      </View>
    );
  }

  const accents = ['#8B4513', '#B87333', '#D18A1F', '#4A7C59'];

  return (
    <View style={styles.list}>
      {services.map((svc, i) => {
        const active = String(svc._id) === String(selectedServiceId);
        return (
          <Pressable key={svc._id} style={[styles.item, active && styles.itemActive]} onPress={() => onSelect?.(svc)}>
            <View style={[styles.iconW, { backgroundColor: accents[i % 4] + '18' }]}>
              <Text style={styles.icon}>✂️</Text>
            </View>
            <View style={styles.body}>
              <Text style={[styles.name, active && { color: Colors.primary }]}>{svc.name}</Text>
              <Text style={styles.meta}>{Number(svc.duration || 0) > 0 ? `${svc.duration} dk` : 'Süre yok'} · ₺{Number(svc.price || 0)}</Text>
            </View>
            <View style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillT, active && { color: '#fff' }]}>{active ? '✓' : 'Seç'}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, padding: 12 },
  itemActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  iconW: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  icon: { fontSize: 18 },
  body: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  meta: { fontSize: 12, color: Colors.textSecondary },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillT: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  empty: { padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.textMuted },
});
