import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchAirports, fetchAllFlights } from '../api/client';
import { AirportSummary, FlightState } from '../types';
import { colors, statusColor } from '../theme';
import { DataSourceBadge } from '../components/DataSourceBadge';
import { formatIstTime } from '../utils/time';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

const formatTime = formatIstTime;

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SearchScreen({ navigation }: Props) {
  const [airports, setAirports] = useState<AirportSummary[]>([]);
  const [selectedAirport, setSelectedAirport] = useState('BLR');
  const [query, setQuery] = useState('');
  const [flights, setFlights] = useState<FlightState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch(() => setAirports([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAllFlights(selectedAirport)
      .then(setFlights)
      .catch(() => setFlights([]))
      .finally(() => setLoading(false));
  }, [selectedAirport]);

  const filtered = flights.filter((f) =>
    f.flightNumber.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const currentAirport = airports.find((a) => a.iata === selectedAirport);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroPlane}>✈️</Text>
          {flights[0] && <DataSourceBadge source={flights[0].dataSource} />}
        </View>
        <Text style={styles.title}>Airport Lifecycle</Text>
        <Text style={styles.subtitle}>
          {currentAirport ? `${currentAirport.name} · ${currentAirport.city}` : 'Door-to-door journey tracking'}
        </Text>

        <View style={styles.airportRow}>
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
        </View>
      </View>

      <TextInput
        style={styles.input}
        placeholder={`Search ${selectedAirport} departures, e.g. 6E835`}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="characters"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => {
          if (query.trim()) {
            navigation.navigate('Journey', { flightNumber: query.trim(), airport: selectedAirport });
          }
        }}
      />

      <Text style={styles.sectionLabel}>Next departures (IST)</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
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
                  → {item.destination} · {formatTime(item.estimatedDeparture)} · {item.airline}
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
  airportRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  airportChip: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  airportChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  airportIata: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  airportIataSelected: { color: colors.background },
  airportCity: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },
  airportCitySelected: { color: colors.background },
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
