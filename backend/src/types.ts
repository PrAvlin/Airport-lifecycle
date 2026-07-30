export type BoardingMethod = 'aerobridge' | 'shuttle_bus';

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
  | 'gate_area'
  | 'boarding'
  | 'departed'
  | 'arrival'
  | 'deplaning'
  | 'baggage_claim'
  | 'exit';

export interface CheckpointEstimate {
  name: string;
  estimatedWaitMinutes: number;
}

/**
 * How confident we actually are that `method` is correct, expressed
 * honestly rather than as a flat estimated/confirmed flag:
 * - 'confirmed': locked in by matching crowd reports on this exact flight.
 * - 'likely': a strong-enough signal (airport layout and/or a quick aircraft
 *   turnaround) that showing a single answer is reasonable, but it's still
 *   not verified - `probability` says how sure we are.
 * - 'uncertain': genuinely a toss-up (e.g. a mixed terminal with no other
 *   signal) - callers must NOT present `method` as a confident single
 *   answer in this case.
 */
export type MethodConfidenceLevel = 'confirmed' | 'likely' | 'uncertain';

export interface MethodEstimate {
  method: BoardingMethod;
  /** 0-1 probability that `method` is the correct one. */
  probability: number;
  confidenceLevel: MethodConfidenceLevel;
  /** Human-readable reasons behind the estimate, most significant first. */
  reasoning: string[];
  /** Crowd reports tallied so far for this exact flight, e.g. { aerobridge: 2 }. */
  reportCounts: Partial<Record<BoardingMethod, number>>;
  /** How many more matching reports on the leading method would lock in 'confirmed'. 0 if already confirmed. */
  reportsToConfirm: number;
}

export interface ArrivalInfo {
  airportIata: string;
  airportName: string;
  airportCity: string;
  terminal: string;
  /** 'TBD' until the destination airport publishes it - usually not until closer to landing. */
  gate: string;
  timezone: string;
  scheduledArrival: string;
  estimatedArrival: string;
  disembark: MethodEstimate;
  /** Only present when the source (AeroDataBox) actually publishes a belt number. */
  baggageBelt?: string;
  baggageWaitMinutes: number;
}

export interface FlightState {
  id: string;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  scheduledDeparture: string;
  estimatedDeparture: string;
  status: FlightStatus;
  terminal: string;
  gate: string;
  /** Aircraft model, e.g. "Airbus A320neo" - present when the data source publishes it. */
  aircraftType?: string;
  boarding: MethodEstimate;
  boardingStartTime: string;
  /** Whether boardingStartTime is airline-confirmed or estimated from typical lead times. */
  boardingStartConfidence: 'estimated' | 'confirmed';
  checkpoints: {
    security: CheckpointEstimate;
  };
  lastUpdated: string;
  dataSource: DataSource;
  arrival: ArrivalInfo;
}

/**
 * A flight arriving INTO one of our supported airports (the mirror image of
 * FlightState, which is a flight departing FROM one). Reuses the exact same
 * gate-level/consensus intelligence for "how you'll get off the plane" -
 * since the destination here is always one of our own registered airports,
 * this side actually tends to have BETTER data than an outbound flight to an
 * arbitrary, uncurated destination.
 */
export interface ArrivalFlightState {
  id: string;
  flightNumber: string;
  airline: string;
  /** IATA of where this flight departed from. */
  origin: string;
  originCity: string;
  originName: string;
  /** IATA of the airport this arrival record belongs to (one of our own). */
  destination: string;
  scheduledArrival: string;
  estimatedArrival: string;
  status: FlightStatus;
  terminal: string;
  /** 'TBD' until published - usually not until closer to landing. */
  gate: string;
  aircraftType?: string;
  disembark: MethodEstimate;
  baggageBelt?: string;
  baggageWaitMinutes: number;
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
