import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlightState, Locality, TrafficEstimate } from '../types';
import { colors } from '../theme';
import { computeLeaveByTime } from '../utils/leaveBy';

interface Props {
  flight: FlightState;
  localities: Locality[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  estimate: TrafficEstimate | null;
  loading: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function TrafficCard({ flight, localities, selectedId, onSelect, estimate, loading }: Props) {
  const leaveBy = estimate ? computeLeaveByTime(flight, estimate) : null;
  const hasDelay = estimate && estimate.delayMinutes > 5;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Traffic to the airport</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {localities.map((loc) => (
          <TouchableOpacity
            key={loc.id}
            style={[styles.chip, selectedId === loc.id && styles.chipSelected]}
            onPress={() => onSelect(loc.id)}
          >
            <Text style={[styles.chipText, selectedId === loc.id && styles.chipTextSelected]}>{loc.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !estimate && <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />}

      {estimate && (
        <View style={styles.body}>
          <View style={styles.row}>
            <Text style={styles.label}>Drive time now</Text>
            <Text style={styles.value}>
              ~{estimate.durationMinutes} min
              {hasDelay ? ` (+${estimate.delayMinutes} min traffic)` : ''}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Distance</Text>
            <Text style={styles.value}>{estimate.distanceKm} km</Text>
          </View>
          {leaveBy && (
            <View style={styles.leaveByBox}>
              <Text style={styles.leaveByLabel}>Leave home by</Text>
              <Text style={styles.leaveByValue}>{formatTime(leaveBy)}</Text>
              <Text style={styles.leaveByHint}>
                Based on drive time, typical security wait, and boarding start.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginTop: 12 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  chipRow: { gap: 8, paddingBottom: 4 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelected: { backgroundColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.background },
  body: { marginTop: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: colors.textSecondary, fontSize: 13 },
  value: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  leaveByBox: {
    marginTop: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
  },
  leaveByLabel: { color: colors.textSecondary, fontSize: 12 },
  leaveByValue: { color: colors.accent, fontSize: 22, fontWeight: '700', marginTop: 2 },
  leaveByHint: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
});
