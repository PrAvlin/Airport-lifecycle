import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DataSource } from '../types';
import { colors } from '../theme';

export function DataSourceBadge({ source }: { source: DataSource }) {
  const isLive = source === 'live';
  return (
    <View style={[styles.badge, isLive ? styles.live : styles.demo]}>
      <View style={[styles.dot, isLive ? styles.dotLive : styles.dotDemo]} />
      <Text style={styles.text}>{isLive ? 'LIVE' : 'DEMO DATA'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    gap: 5,
  },
  live: { backgroundColor: 'rgba(104, 211, 145, 0.15)' },
  demo: { backgroundColor: 'rgba(246, 173, 85, 0.15)' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotLive: { backgroundColor: colors.success },
  dotDemo: { backgroundColor: colors.warning },
  text: { color: colors.textPrimary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
