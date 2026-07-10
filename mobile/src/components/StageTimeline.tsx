import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { JourneyStage } from '../types';
import { colors } from '../theme';

export function StageTimeline({ stages }: { stages: JourneyStage[] }) {
  return (
    <View>
      {stages.map((stage, index) => (
        <View key={stage.id} style={styles.row}>
          <View style={styles.markerColumn}>
            <View
              style={[
                styles.dot,
                stage.isDone && styles.dotDone,
                stage.isActive && styles.dotActive,
              ]}
            />
            {index < stages.length - 1 && (
              <View style={[styles.line, stage.isDone && styles.lineDone]} />
            )}
          </View>
          <View style={styles.textColumn}>
            <Text style={[styles.label, stage.isActive && styles.labelActive]}>{stage.label}</Text>
            <Text style={styles.detail}>{stage.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  markerColumn: { alignItems: 'center', width: 24 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  dotDone: { backgroundColor: colors.accent },
  dotActive: {
    backgroundColor: colors.success,
    transform: [{ scale: 1.2 }],
  },
  line: { flex: 1, width: 2, minHeight: 32, backgroundColor: colors.border, marginVertical: 2 },
  lineDone: { backgroundColor: colors.accent },
  textColumn: { flex: 1, paddingBottom: 20, paddingLeft: 12 },
  label: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  labelActive: { color: colors.textPrimary },
  detail: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
});
