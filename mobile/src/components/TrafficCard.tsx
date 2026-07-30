import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlightState, Locality, TrafficEstimate } from '../types';
import { colors } from '../theme';
import { CheckInStatus, computeLeaveByTime } from '../utils/leaveBy';
import { formatIstTime } from '../utils/time';

interface Props {
  flight: FlightState;
  localities: Locality[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  estimate: TrafficEstimate | null;
  loading: boolean;
}

const formatTime = formatIstTime;

const CHECKIN_OPTIONS: { value: CheckInStatus; label: string }[] = [
  { value: 'not_checked_in', label: "Haven't checked in" },
  { value: 'checked_in_with_bags', label: 'Checked in, have bags' },
  { value: 'checked_in_no_bags', label: 'Checked in, no bags' },
];

// Real Indian domestic airline cutoffs, cited in computeLeaveByTime: counter
// check-in closes 60 min before departure, bag drop 45 min, gate close ~25
// min for a passenger with nothing left to do but board.
const CUTOFF_HINTS: Record<CheckInStatus, string> = {
  not_checked_in: 'Airport counters typically close 60 min before departure',
  checked_in_with_bags: 'Bag drop typically closes 45 min before departure',
  checked_in_no_bags: 'Boarding gates typically close ~25 min before departure',
};

export function TrafficCard({ flight, localities, selectedId, onSelect, estimate, loading }: Props) {
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus>('not_checked_in');
  const leaveBy = estimate ? computeLeaveByTime(flight, estimate, checkInStatus) : null;
  const hasDelay = estimate && estimate.delayMinutes > 5;
  // A recommendation to "leave by" a clock time that has already passed reads
  // as broken rather than urgent - a passenger checking this late needs to be
  // told to leave now, not shown a time that's behind them with no context.
  const isOverdue = leaveBy ? leaveBy.getTime() <= Date.now() : false;

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

          <Text style={styles.checkinLabel}>Your check-in status</Text>
          <View style={styles.checkinRow}>
            {CHECKIN_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.checkinChip, checkInStatus === opt.value && styles.checkinChipSelected]}
                onPress={() => setCheckInStatus(opt.value)}
              >
                <Text style={[styles.checkinChipText, checkInStatus === opt.value && styles.checkinChipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {leaveBy && (
            <View style={[styles.leaveByBox, isOverdue && styles.leaveByBoxUrgent]}>
              <Text style={styles.leaveByLabel}>{isOverdue ? "You're cutting it close" : 'Leave home by'}</Text>
              <Text style={[styles.leaveByValue, isOverdue && styles.leaveByValueUrgent]}>
                {isOverdue ? 'Leave now' : formatTime(leaveBy)}
              </Text>
              <Text style={styles.leaveByHint}>
                {isOverdue
                  ? `Recommended departure (${formatTime(leaveBy)}) has already passed - head out immediately.`
                  : `Based on drive time, typical security wait, and your check-in status. ${CUTOFF_HINTS[checkInStatus]}.`}
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
  checkinLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 8, marginBottom: 6 },
  checkinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkinChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  checkinChipSelected: { backgroundColor: colors.accent },
  checkinChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  checkinChipTextSelected: { color: colors.background },
  leaveByBox: {
    marginTop: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
  },
  leaveByBoxUrgent: { borderWidth: 1, borderColor: colors.danger },
  leaveByLabel: { color: colors.textSecondary, fontSize: 12 },
  leaveByValue: { color: colors.accent, fontSize: 22, fontWeight: '700', marginTop: 2 },
  leaveByValueUrgent: { color: colors.danger },
  leaveByHint: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
});
