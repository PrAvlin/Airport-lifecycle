export interface Locality {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Fallback estimate used when no TomTom API key is configured (no live traffic). */
  typicalMinutesNoTraffic: number;
}

export const BLR_LOCALITIES: Locality[] = [
  { id: 'mg-road', name: 'MG Road / City Centre', latitude: 12.9756, longitude: 77.6068, typicalMinutesNoTraffic: 45 },
  { id: 'koramangala', name: 'Koramangala', latitude: 12.9352, longitude: 77.6245, typicalMinutesNoTraffic: 55 },
  { id: 'indiranagar', name: 'Indiranagar', latitude: 12.9719, longitude: 77.6412, typicalMinutesNoTraffic: 42 },
  { id: 'whitefield', name: 'Whitefield', latitude: 12.9698, longitude: 77.7500, typicalMinutesNoTraffic: 50 },
  { id: 'electronic-city', name: 'Electronic City', latitude: 12.8452, longitude: 77.6602, typicalMinutesNoTraffic: 75 },
  { id: 'hebbal', name: 'Hebbal', latitude: 13.0356, longitude: 77.5970, typicalMinutesNoTraffic: 25 },
  { id: 'yeshwanthpur', name: 'Yeshwanthpur', latitude: 13.0284, longitude: 77.5540, typicalMinutesNoTraffic: 35 },
  { id: 'jayanagar', name: 'Jayanagar', latitude: 12.9308, longitude: 77.5838, typicalMinutesNoTraffic: 55 },
];

export function findLocality(id: string): Locality | undefined {
  return BLR_LOCALITIES.find((loc) => loc.id === id);
}
