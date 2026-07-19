import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchAirports, fetchAllArrivals, fetchAllFlights } from '../api/client';
import { AirportSummary, ArrivalFlightState, FlightState } from '../types';
import { colors, statusColor } from '../theme';
import { DataSourceBadge } from '../components/DataSourceBadge';
import { formatIstTime } from '../utils/time';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

const formatTime = formatIstTime;

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// 'departed' means "already left the origin" - on the arrivals list that
// reads as confusing, since the flight is arriving HERE, so show "Landed".
function formatArrivalStatus(status: string): string {
  if (status === 'departed') return 'Landed';
  return formatStatus(status);
}

export function SearchScreen({ navigation }: Props) {
  const [airports, setAirports] = useState<AirportSummary[]>([]);
  const [selectedAirport, setSelectedAirport] = useState('BLR');
  const [mode, setMode] = useState<'departures' | 'arrivals'>('departures');
  const [query, setQuery] = useState('');
  const [flights, setFlights] = useState<FlightState[]>([]);
  const [arrivals, setArrivals] = useState<ArrivalFlightState[]>([]);
  const [loading, setLoading] = useState(true);
  // Distinguishes "genuinely nothing to show" from "couldn't reach the
  // backend" - previously both showed the exact same silent empty list,
  // which is how a wrong apiBaseUrl or blocked port turns into a confusing
  // "nothing's happening" screen with no clue what's wrong.
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch(() => setAirports([]));
  }, [refreshToken]);

  useEffect(() => {
    // Guards against a slow, now-stale request (e.g. from an airport/mode the
    // user has already switched away from) resolving after a newer one and
    // clobbering the list with out-of-date data.
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (mode === 'departures') {
      fetchAllFlights(selectedAirport)
        .then((data) => {
          if (!cancelled) setFlights(data);
        })
        .catch((err) => {
          if (!cancelled) {
            setFlights([]);
            setError(err.message ?? 'Failed to load departures');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      fetchAllArrivals(selectedAirport)
        .then((data) => {
          if (!cancelled) setArrivals(data);
        })
        .catch((err) => {
          if (!cancelled) {
            setArrivals([]);
            setError(err.message ?? 'Failed to load arrivals');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [selectedAirport, mode, refreshToken]);

  const filteredFlights = flights.filter((f) => f.flightNumber.toLowerCase().includes(query.trim().toLowerCase()));
  const filteredArrivals = arrivals.filter((a) =>
    a.flightNumber.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const currentAirport = airports.find((a) => a.iata === selectedAirport);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroPlane}>✈️</Text>
          {mode === 'departures' && flights[0] && <DataSourceBadge source={flights[0].dataSource} />}
          {mode === 'arrivals' && arrivals[0] && <DataSourceBadge source={arrivals[0].dataSource} />}
        </View>
        <Text style={styles.title}>Airport Lifecycle</Text>
        <Text style={styles.subtitle}>
          {currentAirport ? `${currentAirport.name} · ${currentAirport.city}` : 'Door-to-door journey tracking'}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.airportRow}>
          {airports.map((a) => (
            <TouchableOpacity
              key={a.iata}
              style={[styles.airportChip, selectedAirport === a.iata && styles.airportChipSelected]}
              onPress={() => setSelectedAirport(a.iata)}
            >
              <Text style={[styles.airportIata, selectedAirport === a.iata && styles.airportIataSelected]}>
                {a.iata}
              </Text>
              <Text style={[styles.airportCity, selectedAirport === a.iata && styles.airportCitySelected]}>
                {a.city}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'departures' && styles.modeTabSelected]}
          onPress={() => setMode('departures')}
        >
          <Text style={[styles.modeTabText, mode === 'departures' && styles.modeTabTextSelected]}>Departures</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'arrivals' && styles.modeTabSelected]}
          onPress={() => setMode('arrivals')}
        >
          <Text style={[styles.modeTabText, mode === 'arrivals' && styles.modeTabTextSelected]}>Arrivals</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder={`Search ${selectedAirport} ${mode}, e.g. 6E835`}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="characters"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => {
          if (!query.trim()) return;
          if (mode === 'departures') {
            navigation.navigate('Journey', { flightNumber: query.trim(), airport: selectedAirport });
          } else {
            navigation.navigate('Arrival', { flightNumber: query.trim(), airport: selectedAirport });
          }
        }}
      />

      <Text style={styles.sectionLabel}>
        {mode === 'departures' ? 'Next departures (IST)' : 'Next arrivals (IST)'}
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setRefreshToken((n) => n + 1)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : mode === 'departures' ? (
        <FlatList
          data={filteredFlights}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('Journey', { flightNumber: item.flightNumber, airport: selectedAirport })
              }
            >
              <View style={styles.cardMedallion}>
                <Text style={styles.cardMedallionText}>{item.flightNumber.slice(0, 2)}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardFlight}>{item.flightNumber}</Text>
                  <Text style={[styles.cardStatus, { color: statusColor[item.status] }]}>
                    {formatStatus(item.status)}
                  </Text>
                </View>
                <Text style={styles.cardRoute}>
                  → {item.arrival.airportCity} · Dep {formatTime(item.estimatedDeparture)} · Arr{' '}
                  {formatTime(item.arrival.estimatedArrival)} · {item.airline}
                </Text>
              </View>
              <View style={styles.cardGateBox}>
                <Text style={styles.cardGateLabel}>{item.terminal}</Text>
                <Text style={styles.cardGate}>{item.gate === 'TBD' ? '—' : item.gate}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={filteredArrivals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('Arrival', { flightNumber: item.flightNumber, airport: selectedAirport })
              }
            >
              <View style={styles.cardMedallion}>
                <Text style={styles.cardMedallionText}>{item.flightNumber.slice(0, 2)}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardFlight}>{item.flightNumber}</Text>
                  <Text style={[styles.cardStatus, { color: statusColor[item.status] }]}>
                    {formatArrivalStatus(item.status)}
                  </Text>
                </View>
                <Text style={styles.cardRoute}>
                  From {item.originCity} · {formatTime(item.estimatedArrival)} · {item.airline}
                </Text>
              </View>
              <View style={styles.cardGateBox}>
                <Text style={styles.cardGateLabel}>{item.terminal}</Text>
                <Text style={styles.cardGate}>{item.gate === 'TBD' ? '—' : item.gate}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 56 },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  heroPlane: { fontSize: 24 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
  airportRow: { flexDirection: 'row', gap: 8, marginTop: 14, paddingRight: 4 },
  airportChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 68,
  },
  airportChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  airportIata: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  airportIataSelected: { color: colors.background },
  airportCity: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },
  airportCitySelected: { color: colors.background },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeTab: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeTabSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeTabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  modeTabTextSelected: { color: colors.background },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 18, marginBottom: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: { color: colors.danger, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryButton: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 20,
  },
  retryButtonText: { color: colors.background, fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 13,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardMedallion: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMedallionText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardFlight: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  cardStatus: { fontSize: 11, fontWeight: '700' },
  cardRoute: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  cardGateBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 44,
  },
  cardGateLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: '700' },
  cardGate: { color: colors.accent, fontSize: 15, fontWeight: '800' },
});
