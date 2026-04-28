import React from 'react';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';

export default function DateStrip({ days, selectedDate, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {(days || []).map((day) => {
        const isSelected = selectedDate === day.value;
        return (
          <Pressable
            key={day.value}
            style={[styles.dayCard, isSelected && styles.dayCardSelected]}
            onPress={() => onSelect?.(day.value)}
          >
            <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>{day.dayName}</Text>
            <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>{day.dayNumber}</Text>
            <Text style={[styles.monthName, isSelected && styles.monthNameSelected]}>{day.monthName}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    gap: 8,
  },
  dayCard: {
    width: 64,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  dayCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  dayNameSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  dayNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  dayNumberSelected: {
    color: '#ffffff',
  },
  monthName: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'capitalize',
    marginTop: 1,
  },
  monthNameSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
});
