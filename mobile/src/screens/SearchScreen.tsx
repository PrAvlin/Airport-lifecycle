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
import { fetchAllFlights } from '../api/client';
import { FlightState } from '../types';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

export function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [flights, setFlights] = useState<FlightState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllFlights()
      .then(setFlights)
      .catch(() => setFlights([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = flights.filter((f) =>
    f.flightNumber.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Airport Lifecycle</Text>
      <Text style={styles.subtitle}>Track your journey from entry to boarding.</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter flight number, e.g. 6E835"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="characters"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => {
          if (query.trim()) navigation.navigate('Journey', { flightNumber: query.trim() });
        }}
      />

      <Text style={styles.sectionLabel}>Demo flights (simulated live data)</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('Journey', { flightNumber: item.flightNumber })}
            >
              <View>
                <Text style={styles.cardFlight}>{item.flightNumber}</Text>
                <Text style={styles.cardRoute}>
                  {item.origin} → {item.destination} · {item.airline}
                </Text>
              </View>
              <Text style={styles.cardGate}>Gate {item.gate}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 20 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: { color: colors.textSecondary, fontSize: 13, marginTop: 24, marginBottom: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFlight: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  cardRoute: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  cardGate: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
