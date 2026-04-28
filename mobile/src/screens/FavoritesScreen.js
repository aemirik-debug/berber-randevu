import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { fetchFavorites, removeFavorite } from '../services/favoriteService';
import { showToast } from '../components/Toast';

export default function FavoritesScreen({ navigation }) {
  const { customerId } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState('');

  const loadFavorites = useCallback(async () => {
    if (!customerId) { setLoading(false); return; }
    try {
      const list = await fetchFavorites(customerId);
      setFavorites(list);
    } catch { setFavorites([]); }
    finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFavorites();
    setRefreshing(false);
  }, [loadFavorites]);

  const handleRemove = (fav) => {
    Alert.alert('Favori Kaldır', `${fav.barberName || 'Bu berber'} favorilerden kaldırılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır', style: 'destructive', onPress: async () => {
          setRemovingId(fav.barberId);
          try {
            await removeFavorite(customerId, fav.barberId);
            setFavorites(prev => prev.filter(f => f.barberId !== fav.barberId));
            showToast('Favori kaldırıldı.', 'success');
          } catch (err) { showToast(err.message || 'Kaldırılamadı.', 'danger'); }
          finally { setRemovingId(''); }
        }
      },
    ]);
  };

  const handleBooking = (fav) => {
    navigation.navigate('Booking', { prefill: { city: fav.city, district: fav.district, barberId: fav.barberId } });
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </Pressable>
        <Text style={styles.title}>❤️ Favori Berberlerim</Text>
        <Text style={styles.subtitle}>{favorites.length} favori</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>❤️</Text>
          <Text style={styles.emptyTitle}>Henüz favori yok</Text>
          <Text style={styles.emptyText}>Ana sayfadan beğendiğin berberleri favorilerine ekleyebilirsin.</Text>
        </View>
      ) : (
        favorites.map(fav => (
          <View key={fav.barberId} style={styles.favCard}>
            <View style={styles.favHeader}>
              <View style={styles.favAvatar}>
                <Text style={styles.favAvatarText}>{(fav.barberName || 'B').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.favInfo}>
                <Text style={styles.favName}>{fav.barberName || 'Berber'}</Text>
                <Text style={styles.favMeta}>📍 {fav.city || 'Şehir yok'} / {fav.district || 'İlçe yok'}</Text>
                {fav.phone ? <Text style={styles.favMeta}>📞 {fav.phone}</Text> : null}
              </View>
            </View>
            <View style={styles.favActions}>
              <Pressable style={styles.favBookBtn} onPress={() => handleBooking(fav)}>
                <Text style={styles.favBookText}>📅 Randevu Al</Text>
              </Pressable>
              <Pressable style={styles.favRemoveBtn} onPress={() => handleRemove(fav)} disabled={removingId === fav.barberId}>
                <Text style={styles.favRemoveText}>{removingId === fav.barberId ? '...' : '🗑 Kaldır'}</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  emptyCard: { marginHorizontal: 20, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 32, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  favCard: { marginHorizontal: 20, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10 },
  favHeader: { flexDirection: 'row', marginBottom: 12 },
  favAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  favAvatarText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  favInfo: { flex: 1, justifyContent: 'center' },
  favName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  favMeta: { fontSize: 12, color: Colors.textSecondary, marginBottom: 1 },
  favActions: { flexDirection: 'row', gap: 8 },
  favBookBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center' },
  favBookText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  favRemoveBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Colors.danger, backgroundColor: Colors.dangerBg },
  favRemoveText: { fontSize: 13, fontWeight: '600', color: Colors.danger },
});
