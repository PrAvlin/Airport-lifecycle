import { useMemo } from 'react';
import { FlightState, JourneyStage } from '../types';

function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
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
        detail:
          boardingMethodLabel(flight.boardingMethod) +
          (flight.boardingMethodConfidence === 'estimated' ? ' (estimated — confirm at your gate display)' : ''),
        isDone: flight.status === 'gate_closed' || isDeparted,
        isActive: isBoardingOrLater && !isDeparted,
      },
      {
        id: 'departed',
        label: 'Departed',
        detail: `Departure ${new Date(flight.estimatedDeparture).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        isDone: isDeparted,
        isActive: isDeparted,
      },
    );

    return stages;
  }, [flight]);
}

export function boardingMethodLabel(method: FlightState['boardingMethod']): string {
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
