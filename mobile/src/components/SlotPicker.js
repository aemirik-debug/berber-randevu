import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';

export default function SlotPicker({ slots, selectedSlotId, onSelect }) {
  if (!slots || slots.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Bu tarihte müsait saat bulunamadı.</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {slots.map((slot) => {
        const time = String(slot.time || '').slice(0, 5);
        const isSelected = String(slot._id) === String(selectedSlotId);
        const isBookable = String(slot.status || '').toLowerCase() === 'available';
        const isPast = slot.isPastSlot === true;
        const disabled = !isBookable || isPast;

        return (
          <Pressable
            key={slot._id}
            style={[
              styles.slot,
              isSelected && styles.slotSelected,
              disabled && styles.slotDisabled,
            ]}
            onPress={() => !disabled && onSelect?.(slot)}
            disabled={disabled}
          >
            <Text
              style={[
                styles.slotText,
                isSelected && styles.slotTextSelected,
                disabled && styles.slotTextDisabled,
              ]}
            >
              {time}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    width: 72,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  slotDisabled: {
    backgroundColor: Colors.skeleton,
    borderColor: Colors.borderLight,
    opacity: 0.5,
  },
  slotText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  slotTextSelected: {
    color: '#ffffff',
  },
  slotTextDisabled: {
    color: Colors.textMuted,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
