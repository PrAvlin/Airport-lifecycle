import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useArrivalStatus } from '../hooks/useArrivalStatus';
import { DataSourceBadge } from '../components/DataSourceBadge';
import { MethodEstimateCard } from '../components/MethodEstimateCard';
import { colors, statusColor } from '../theme';
import { formatIstTime } from '../utils/time';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Arrival'>;

const formatTime = formatIstTime;

// FlightStatus is shared between departures and arrivals, but 'departed' means
// "already left the origin" - for an arrivals screen the passenger cares
// whether THIS aircraft has landed here, so it reads as "Landed" instead.
function formatStatus(status: string): string {
  if (status === 'departed') return 'Landed';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ArrivalScreen({ route, navigation }: Props) {
  const { flightNumber, airport } = route.params;
  const { arrival, loading, error, setArrival } = useArrivalStatus(flightNumber, airport);

  if (loading && !arrival) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error && !arrival) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back to search</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!arrival) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      <View style={styles.headerRow}>
        <Text style={styles.flightNumber}>{arrival.flightNumber}</Text>
        <Text style={[styles.status, { color: statusColor[arrival.status] }]}>
          {formatStatus(arrival.status)}
        </Text>
      </View>
      <View style={styles.subHeaderRow}>
        <Text style={styles.route}>
          {arrival.originCity} ({arrival.origin}) → {airport} · {arrival.airline}
        </Text>
        <DataSourceBadge source={arrival.dataSource} />
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Arrival terminal / gate</Text>
          <Text style={styles.infoValue}>
            {arrival.terminal === 'TBD' ? 'Not yet published' : arrival.terminal} ·{' '}
            {arrival.gate === 'TBD' ? 'Not yet published' : arrival.gate}
          </Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Landing time</Text>
          <Text style={styles.infoValue}>{formatTime(arrival.estimatedArrival)}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>From</Text>
          <Text style={styles.infoValue}>{arrival.originCity}</Text>
        </View>
        {arrival.aircraftType && (
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Aircraft</Text>
            <Text style={styles.infoValue}>{arrival.aircraftType}</Text>
          </View>
        )}
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Baggage belt</Text>
          <Text style={styles.infoValue}>{arrival.baggageBelt ?? 'Not yet published'}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Baggage wait (est.)</Text>
          <Text style={styles.infoValue}>~{arrival.baggageWaitMinutes} min</Text>
        </View>
      </View>

      <MethodEstimateCard
        key={`${arrival.id}:deplane`}
        title="How you'll get off the plane"
        estimate={arrival.disembark}
        flightNumber={arrival.flightNumber}
        airport={airport}
        phase="deplane"
        source="arrival"
        onReported={(disembark) => setArrival({ ...arrival, disembark })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, fontSize: 15, padding: 20, textAlign: 'center' },
  backButton: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flightNumber: { color: colors.textPrimary, fontSize: 30, fontWeight: '700' },
  status: { fontSize: 15, fontWeight: '700' },
  subHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  route: { color: colors.textSecondary, fontSize: 14 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 10 },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    width: '47%',
  },
  infoLabel: { color: colors.textSecondary, fontSize: 12 },
  infoValue: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 4 },
});
