import { useMemo } from 'react';
import { FlightState, JourneyStage, MethodEstimate } from '../types';

function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

function formatTimeInZone(iso: string, timeZone: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone });
  } catch {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// How long after touchdown before a passenger is realistically off the aircraft,
// used only to sequence the timeline - not a claim about any specific flight.
const TAXI_TO_STAND_MINUTES = 15;
const DISEMBARK_MINUTES = 10;

/**
 * Summarizes a method estimate for the timeline in one line, honestly
 * reflecting how sure we actually are - never stating "jet bridge" or
 * "shuttle bus" as if it were fact unless it's confirmed or a strong
 * enough signal to call "likely."
 */
function summarizeMethodEstimate(estimate: MethodEstimate, labelFn: (m: FlightState['boarding']['method']) => string): string {
  if (estimate.confidenceLevel === 'uncertain') {
    return 'Not yet known whether this is a jet bridge, a shuttle bus, or a short walk — could be either. Come prepared for a bus just in case.';
  }
  const base = labelFn(estimate.method);
  if (estimate.confidenceLevel === 'confirmed') {
    return `${base} (confirmed by fellow passengers)`;
  }
  return `${base} (~${Math.round(estimate.probability * 100)}% likely — not yet confirmed)`;
}

export function useJourneyStages(flight: FlightState | null): JourneyStage[] {
  return useMemo(() => {
    if (!flight) return [];

    const minutesToBoarding = minutesUntil(flight.boardingStartTime);
    const minutesToDeparture = minutesUntil(flight.scheduledDeparture);
    const isBoardingOrLater = ['boarding', 'final_call', 'gate_closed', 'departed'].includes(flight.status);
    const isDeparted = flight.status === 'departed';

    const stages: JourneyStage[] = [
      {
        id: 'entry',
        label: 'Airport entry',
        detail: 'Arrive at terminal and locate your check-in counter.',
        isDone: true,
        isActive: false,
      },
      {
        id: 'check_in',
        label: 'Check-in / bag drop',
        detail: `Terminal ${flight.terminal} · Counter allocated on arrival.`,
        isDone: true,
        isActive: false,
      },
      {
        id: 'security',
        label: 'Security screening',
        detail: `${flight.checkpoints.security.name} · ~${flight.checkpoints.security.estimatedWaitMinutes} min typical wait`,
        isDone: minutesToBoarding < 20,
        isActive: minutesToBoarding >= 20 && minutesToBoarding < 60,
      },
    ];

    if (flight.checkpoints.immigration) {
      stages.push({
        id: 'immigration',
        label: 'Immigration',
        detail: `${flight.checkpoints.immigration.name} · ~${flight.checkpoints.immigration.estimatedWaitMinutes} min typical wait`,
        isDone: minutesToBoarding < 15,
        isActive: minutesToBoarding >= 15 && minutesToBoarding < 20,
      });
    }

    stages.push(
      {
        id: 'gate_area',
        label: `Gate ${flight.gate} area`,
        detail: `Terminal ${flight.terminal}${flight.gate === 'TBD' ? ' · Gate not yet assigned' : ''}`,
        isDone: isBoardingOrLater,
        isActive: !isBoardingOrLater && minutesToBoarding < 15,
      },
      {
        id: 'boarding',
        label: 'Boarding',
        detail: summarizeMethodEstimate(flight.boarding, boardingMethodLabel),
        isDone: flight.status === 'gate_closed' || isDeparted,
        isActive: isBoardingOrLater && !isDeparted,
      },
      {
        id: 'departed',
        label: 'Departed',
        detail: `Departure ${new Date(flight.estimatedDeparture).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · lands ~${formatTimeInZone(flight.arrival.estimatedArrival, flight.arrival.timezone)} local`,
        isDone: isDeparted,
        isActive: isDeparted,
      },
    );

    // ---- arrival-side stages: touchdown -> deplaning -> immigration -> bags -> exit ----
    const minutesToTouchdown = minutesUntil(flight.arrival.estimatedArrival);
    const minutesToGate = minutesToTouchdown + TAXI_TO_STAND_MINUTES;
    const minutesToDeplaningDone = minutesToGate + DISEMBARK_MINUTES;
    const immigrationWaitMinutes = flight.isInternational ? flight.arrival.immigrationWaitMinutes ?? 0 : 0;
    const minutesToImmigrationDone = minutesToDeplaningDone + immigrationWaitMinutes;
    const minutesToBaggageDone = minutesToImmigrationDone + flight.arrival.baggageWaitMinutes;

    stages.push(
      {
        id: 'arrival',
        label: `Arrival at ${flight.arrival.airportName}`,
        detail: `Touching down ~${formatTimeInZone(flight.arrival.estimatedArrival, flight.arrival.timezone)} local time`,
        isDone: minutesToGate <= 0,
        isActive: minutesToTouchdown <= 0 && minutesToGate > 0,
      },
      {
        id: 'deplaning',
        label: 'Deplaning',
        detail: summarizeMethodEstimate(flight.arrival.disembark, disembarkMethodLabel),
        isDone: minutesToDeplaningDone <= 0,
        isActive: minutesToGate <= 0 && minutesToDeplaningDone > 0,
      },
    );

    if (flight.isInternational) {
      stages.push({
        id: 'arrival_immigration',
        label: 'Immigration & Customs',
        detail: `~${immigrationWaitMinutes} min typical wait`,
        isDone: minutesToImmigrationDone <= 0,
        isActive: minutesToDeplaningDone <= 0 && minutesToImmigrationDone > 0,
      });
    }

    stages.push(
      {
        id: 'baggage_claim',
        label: 'Baggage claim',
        detail: flight.arrival.baggageBelt
          ? `Belt ${flight.arrival.baggageBelt} · ~${flight.arrival.baggageWaitMinutes} min typical wait`
          : `Belt not yet published · ~${flight.arrival.baggageWaitMinutes} min typical wait`,
        isDone: minutesToBaggageDone <= 0,
        isActive: minutesToImmigrationDone <= 0 && minutesToBaggageDone > 0,
      },
      {
        id: 'exit',
        label: 'Exit to arrival city',
        detail: `Welcome to ${flight.arrival.airportName}.`,
        isDone: minutesToBaggageDone <= 0,
        isActive: minutesToBaggageDone <= 0,
      },
    );

    return stages;
  }, [flight]);
}

export function boardingMethodLabel(method: FlightState['boarding']['method']): string {
  switch (method) {
    case 'jet_bridge':
      return 'Boarding via jet bridge — walk directly from the gate to the aircraft door.';
    case 'shuttle_bus':
      return 'Boarding via shuttle bus — you will be bused to the aircraft on the tarmac.';
    case 'walk_to_aircraft':
      return 'Boarding on foot — a short walk across the apron to the aircraft.';
    default:
      return '';
  }
}

export function disembarkMethodLabel(method: FlightState['boarding']['method']): string {
  switch (method) {
    case 'jet_bridge':
      return 'Deplaning via jet bridge — walk directly off into the terminal.';
    case 'shuttle_bus':
      return 'Deplaning onto a shuttle bus — you will be bused from the aircraft to the terminal.';
    case 'walk_to_aircraft':
      return 'Deplaning on foot — a short walk across the apron into the terminal.';
    default:
      return '';
  }
}
