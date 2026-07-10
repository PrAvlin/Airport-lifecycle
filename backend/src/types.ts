export type BoardingMethod = 'jet_bridge' | 'shuttle_bus' | 'walk_to_aircraft';

export type FlightStatus =
  | 'scheduled'
  | 'delayed'
  | 'boarding'
  | 'final_call'
  | 'gate_closed'
  | 'departed'
  | 'cancelled';

export type JourneyStageId =
  | 'entry'
  | 'check_in'
  | 'security'
  | 'immigration'
  | 'gate_area'
  | 'boarding'
  | 'departed';

export interface CheckpointEstimate {
  name: string;
  estimatedWaitMinutes: number;
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
  boardingMethod: BoardingMethod;
  /** Whether boardingMethod is real airline-confirmed data or a heuristic estimate. */
  boardingMethodConfidence: 'estimated' | 'confirmed';
  boardingStartTime: string;
  /** Whether boardingStartTime is airline-confirmed or estimated from typical lead times. */
  boardingStartConfidence: 'estimated' | 'confirmed';
  checkpoints: {
    security: CheckpointEstimate;
    immigration?: CheckpointEstimate;
  };
  lastUpdated: string;
  dataSource: DataSource;
}

export type DataSource = 'live' | 'demo';

export interface TrafficEstimate {
  localityId: string;
  localityName: string;
  distanceKm: number;
  durationMinutes: number;
  typicalDurationMinutes: number;
  delayMinutes: number;
  dataSource: DataSource;
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
