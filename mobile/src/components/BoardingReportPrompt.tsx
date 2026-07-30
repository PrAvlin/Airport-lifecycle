import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { submitBoardingReport, submitDeplaneReport } from '../api/client';
import { BoardingMethod, MethodEstimate } from '../types';
import { colors } from '../theme';

interface Props {
  flightNumber: string;
  airport: string;
  phase: 'board' | 'deplane';
  /** Arrivals-list flights use a separate endpoint (no 'phase' body field - it's always deplaning). */
  source?: 'flight' | 'arrival';
  /**
   * Called with the freshly-recomputed estimate right after a successful
   * submit, so the parent screen can update its badge immediately instead of
   * leaving the passenger looking at their OLD estimate until the next poll -
   * which reads as "did my report even do anything?".
   */
  onReported?: (estimate: MethodEstimate) => void;
}

const OPTIONS: { method: BoardingMethod; label: string; icon: string }[] = [
  { method: 'aerobridge', label: 'Aerobridge', icon: '🌉' },
  { method: 'shuttle_bus', label: 'Shuttle', icon: '🚌' },
];

export function BoardingReportPrompt({ flightNumber, airport, phase, source = 'flight', onReported }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(method: BoardingMethod) {
    setSubmitting(true);
    try {
      if (source === 'arrival') {
        const arrival = await submitDeplaneReport(flightNumber, method, airport);
        onReported?.(arrival.disembark);
      } else {
        const flight = await submitBoardingReport(flightNumber, phase, method, airport);
        onReported?.(phase === 'board' ? flight.boarding : flight.arrival.disembark);
      }
      setSubmitted(true);
    } catch {
      // Best-effort - if this fails (including a timeout) the user can just try again.
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <Text style={styles.thanks}>Thanks — your report helps confirm this for other passengers.</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>Seen this in person? Tell other passengers what to expect:</Text>
      <View style={styles.row}>
        {OPTIONS.map((opt) => (
          <TouchableOpacity key={opt.method} style={styles.chip} disabled={submitting} onPress={() => submit(opt.method)}>
            <Text style={styles.chipText}>
              {opt.icon} {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  prompt: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  thanks: { color: colors.success, fontSize: 12, marginTop: 10 },
});
