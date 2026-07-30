import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BoardingMethod } from '../types';
import { colors } from '../theme';

const CONFIG: Record<BoardingMethod, { icon: string; label: string }> = {
  aerobridge: { icon: '🌉', label: 'Aerobridge' },
  shuttle_bus: { icon: '🚌', label: 'Shuttle' },
};

export function BoardingMethodBadge({ method }: { method: BoardingMethod }) {
  const config = CONFIG[method];
  return (
    <View style={styles.badge}>
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={styles.label}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  icon: { fontSize: 16 },
  label: { color: colors.textPrimary, fontWeight: '600', fontSize: 13 },
});
