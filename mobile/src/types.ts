export type BoardingMethod = 'jet_bridge' | 'shuttle_bus' | 'walk_to_aircraft';

export type FlightStatus =
  | 'scheduled'
  | 'delayed'
  | 'boarding'
  | 'final_call'
  | 'gate_closed'
  | 'departed'
  | 'cancelled';

export type DataSource = 'live' | 'demo';

export interface CheckpointEstimate {
  name: string;
  estimatedWaitMinutes: number;
}

export type MethodConfidenceLevel = 'confirmed' | 'likely' | 'uncertain';

export interface MethodEstimate {
  method: BoardingMethod;
  probability: number;
  confidenceLevel: MethodConfidenceLevel;
  reasoning: string[];
  reportCounts: Partial<Record<BoardingMethod, number>>;
  reportsToConfirm: number;
}

export interface ArrivalInfo {
  airportIata: string;
  airportName: string;
  airportCity: string;
  terminal: string;
  timezone: string;
  scheduledArrival: string;
  estimatedArrival: string;
  disembark: MethodEstimate;
  baggageBelt?: string;
  immigrationWaitMinutes?: number;
  baggageWaitMinutes: number;
}

export interface FlightState {
  id: string;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  isInternational: boolean;
  scheduledDeparture: string;
  estimatedDeparture: string;
  status: FlightStatus;
  terminal: string;
  gate: string;
  boarding: MethodEstimate;
  boardingStartTime: string;
  boardingStartConfidence: 'estimated' | 'confirmed';
  checkpoints: {
    security: CheckpointEstimate;
    immigration?: CheckpointEstimate;
  };
  lastUpdated: string;
  dataSource: DataSource;
  arrival: ArrivalInfo;
}

export type FlightUpdateEventType =
  | 'status_change'
  | 'gate_change'
  | 'boarding_method_change'
  | 'delay'
  | 'wait_time_update';

export interface FlightUpdateEvent {
  type: FlightUpdateEventType;
  flightId: string;
  flight: FlightState;
  message: string;
  timestamp: string;
}

export type JourneyStageId =
  | 'entry'
  | 'check_in'
  | 'security'
  | 'immigration'
  | 'gate_area'
  | 'boarding'
  | 'departed'
  | 'arrival'
  | 'deplaning'
  | 'arrival_immigration'
  | 'baggage_claim'
  | 'exit';

export interface JourneyStage {
  id: JourneyStageId;
  label: string;
  detail: string;
  isActive: boolean;
  isDone: boolean;
}

export interface Locality {
  id: string;
  name: string;
}

export interface AirportSummary {
  iata: string;
  name: string;
  city: string;
  terminals: string[];
}

export interface TrafficEstimate {
  localityId: string;
  localityName: string;
  distanceKm: number;
  durationMinutes: number;
  typicalDurationMinutes: number;
  delayMinutes: number;
  dataSource: DataSource;
}
