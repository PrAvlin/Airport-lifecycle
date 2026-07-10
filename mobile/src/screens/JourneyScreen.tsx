import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFlightStatus } from '../hooks/useFlightStatus';
import { useJourneyStages } from '../hooks/useJourneyStages';
import { StageTimeline } from '../components/StageTimeline';
import { BoardingMethodBadge } from '../components/BoardingMethodBadge';
import { colors, statusColor } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Journey'>;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function JourneyScreen({ route }: Props) {
  const { flightNumber } = route.params;
  const { flight, loading, error, lastEvent } = useFlightStatus(flightNumber);
  const stages = useJourneyStages(flight);

  if (loading && !flight) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error && !flight) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!flight) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      <View style={styles.headerRow}>
        <Text style={styles.flightNumber}>{flight.flightNumber}</Text>
        <Text style={[styles.status, { color: statusColor[flight.status] }]}>
          {formatStatus(flight.status)}
        </Text>
      </View>
      <Text style={styles.route}>
        {flight.origin} → {flight.destination} · {flight.airline}
      </Text>

      {lastEvent && (
        <View style={styles.liveBanner}>
          <Text style={styles.liveBannerText}>🔴 Live: {lastEvent.message}</Text>
        </View>
      )}

      <View style={styles.infoGrid}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Terminal / Gate</Text>
          <Text style={styles.infoValue}>{flight.terminal} · {flight.gate}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Departure</Text>
          <Text style={styles.infoValue}>{formatTime(flight.estimatedDeparture)}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Boarding starts</Text>
          <Text style={styles.infoValue}>{formatTime(flight.boardingStartTime)}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Boarding group</Text>
          <Text style={styles.infoValue}>{flight.boardingGroup}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>How you'll board</Text>
      <BoardingMethodBadge method={flight.boardingMethod} />

      <Text style={styles.sectionTitle}>Your journey</Text>
      <StageTimeline stages={stages} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, fontSize: 15, padding: 20, textAlign: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flightNumber: { color: colors.textPrimary, fontSize: 30, fontWeight: '700' },
  status: { fontSize: 15, fontWeight: '700' },
  route: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  liveBanner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  liveBannerText: { color: colors.textPrimary, fontSize: 13 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 10 },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    width: '47%',
  },
  infoLabel: { color: colors.textSecondary, fontSize: 12 },
  infoValue: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 4 },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 28, marginBottom: 12 },
});
