import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';

const renderStars = (value) => {
  const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
};

export default function BarberCard({ barber, selected = false, onPress }) {
  const salonName = barber?.salonName || barber?.name || 'Berber';
  const barberName = barber?.name || '';
  const city = barber?.city || 'Şehir yok';
  const district = barber?.district || 'İlçe yok';
  const serviceCount = barber?.services?.length || 0;
  const address = barber?.address || 'Adres bilgisi yok';
  const avgRating = Number(barber?.avgRating || 0).toFixed(1);
  const reviewCount = barber?.reviewCount || 0;
  const latestComment = barber?.latestReview?.comment || '';
  const logoUrl = barber?.logoUrl;

  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={() => onPress?.(barber)}
    >
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>{salonName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.salonName} numberOfLines={1}>{salonName}</Text>
          <Text style={styles.meta} numberOfLines={1}>{barberName} · {city} / {district}</Text>
          <Text style={styles.meta} numberOfLines={1}>{serviceCount} hizmet · {address}</Text>
        </View>
      </View>

      <View style={styles.ratingRow}>
        <Text style={styles.stars}>{renderStars(barber?.avgRating)}</Text>
        <Text style={styles.ratingText}>{avgRating} ({reviewCount} yorum)</Text>
      </View>

      {latestComment ? (
        <Text style={styles.comment} numberOfLines={2}>"{latestComment}"</Text>
      ) : (
        <Text style={styles.commentEmpty}>Henüz yorum yok.</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  salonName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stars: {
    fontSize: 14,
    color: '#f59e0b',
    marginRight: 6,
  },
  ratingText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  comment: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  commentEmpty: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
});
