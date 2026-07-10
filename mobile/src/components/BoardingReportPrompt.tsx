import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../api/client';
import { BoardingMethod } from '../types';
import { colors } from '../theme';

interface Props {
  flightNumber: string;
  airport: string;
  phase: 'board' | 'deplane';
}

const OPTIONS: { method: BoardingMethod; label: string; icon: string }[] = [
  { method: 'jet_bridge', label: 'Jet Bridge', icon: '🌉' },
  { method: 'shuttle_bus', label: 'Shuttle Bus', icon: '🚌' },
  { method: 'walk_to_aircraft', label: 'Walk', icon: '🚶' },
];

export function BoardingReportPrompt({ flightNumber, airport, phase }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(method: BoardingMethod) {
    setSubmitting(true);
    try {
      await fetch(`${API_BASE_URL}/flights/${encodeURIComponent(flightNumber)}/boarding-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, method, airport }),
      });
      setSubmitted(true);
    } catch {
      // Best-effort - if this fails the user can just try again later.
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
