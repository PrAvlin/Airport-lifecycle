import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFlightStatus } from '../hooks/useFlightStatus';
import { useJourneyStages } from '../hooks/useJourneyStages';
import { useTraffic } from '../hooks/useTraffic';
import { StageTimeline } from '../components/StageTimeline';
import { DataSourceBadge } from '../components/DataSourceBadge';
import { MethodEstimateCard } from '../components/MethodEstimateCard';
import { TrafficCard } from '../components/TrafficCard';
import { colors, statusColor } from '../theme';
import { formatDuration, formatIstTime } from '../utils/time';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Journey'>;

const formatTime = formatIstTime;

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function JourneyScreen({ route }: Props) {
  const { flightNumber, airport } = route.params;
  const { flight, loading, error, lastEvent } = useFlightStatus(flightNumber, airport);
  const stages = useJourneyStages(flight);
  const traffic = useTraffic(airport);

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
      <View style={styles.subHeaderRow}>
        <Text style={styles.route}>
          {flight.origin} → {flight.arrival.airportCity}
          {flight.destination !== 'N/A' ? ` (${flight.destination})` : ''} · {flight.airline}
        </Text>
        <DataSourceBadge source={flight.dataSource} />
      </View>

      {lastEvent && (
        <View style={styles.liveBanner}>
          <Text style={styles.liveBannerText}>🔴 {lastEvent.message}</Text>
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
          <Text style={styles.infoValue}>
            {formatTime(flight.boardingStartTime)}
            {flight.boardingStartConfidence === 'estimated' ? ' (est.)' : ''}
          </Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Arrival terminal / gate</Text>
          <Text style={styles.infoValue}>
            {flight.arrival.terminal === 'TBD' ? 'TBD' : flight.arrival.terminal} ·{' '}
            {flight.arrival.gate === 'TBD' ? 'Not yet published' : flight.arrival.gate}
          </Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Flight duration</Text>
          <Text style={styles.infoValue}>
            {formatDuration(flight.estimatedDeparture, flight.arrival.estimatedArrival)}
          </Text>
        </View>
        {flight.aircraftType && (
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Aircraft</Text>
            <Text style={styles.infoValue}>{flight.aircraftType}</Text>
          </View>
        )}
      </View>

      <MethodEstimateCard
        key={`${flight.id}:board`}
        title="How you'll board"
        estimate={flight.boarding}
        flightNumber={flight.flightNumber}
        airport={airport}
        phase="board"
      />

      <TrafficCard
        flight={flight}
        localities={traffic.localities}
        selectedId={traffic.selectedId}
        onSelect={traffic.setSelectedId}
        estimate={traffic.estimate}
        loading={traffic.loading}
      />

      <MethodEstimateCard
        key={`${flight.id}:deplane`}
        title="How you'll get off the plane"
        estimate={flight.arrival.disembark}
        flightNumber={flight.flightNumber}
        airport={airport}
        phase="deplane"
      />

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
  subHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  route: { color: colors.textSecondary, fontSize: 14 },
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
