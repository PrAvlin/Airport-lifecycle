import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deriveDepartureStatus, deriveArrivalStatus, findQuickTurns, AeroDataBoxFlight } from '../services/aerodatabox';

function minutesFromNow(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

describe('deriveDepartureStatus', () => {
  test('a flight far from departure with no source status is "scheduled"', () => {
    assert.equal(deriveDepartureStatus(undefined, minutesFromNow(120)), 'scheduled');
  });

  test('within 10 minutes with no source status is "final_call"', () => {
    assert.equal(deriveDepartureStatus(undefined, minutesFromNow(8)), 'final_call');
  });

  test('within 5 minutes with no source status is "gate_closed"', () => {
    assert.equal(deriveDepartureStatus(undefined, minutesFromNow(2)), 'gate_closed');
  });

  test('more than an hour overdue with no source status settles on "departed", not "final_call" forever', () => {
    assert.equal(deriveDepartureStatus(undefined, minutesFromNow(-90)), 'departed');
    assert.equal(deriveDepartureStatus(undefined, minutesFromNow(-300)), 'departed');
  });

  test('an explicit source status (e.g. Delayed) is trusted over time-based guessing', () => {
    assert.equal(deriveDepartureStatus('Delayed', minutesFromNow(120)), 'delayed');
  });
});

describe('deriveArrivalStatus', () => {
  test('boarding-only source statuses never leak onto an arrival', () => {
    // These raw AeroDataBox statuses map to boarding/final_call/gate_closed in
    // STATUS_MAP, which make no sense for a flight that is LANDING, not
    // departing - deriveArrivalStatus must not surface them.
    assert.equal(deriveArrivalStatus('Boarding', minutesFromNow(8)), 'scheduled');
    assert.equal(deriveArrivalStatus('GateClosed', minutesFromNow(2)), 'scheduled');
  });

  test('a real explicit status (delayed/cancelled/arrived) is still trusted', () => {
    assert.equal(deriveArrivalStatus('Delayed', minutesFromNow(30)), 'delayed');
    assert.equal(deriveArrivalStatus('Canceled', minutesFromNow(30)), 'cancelled');
    assert.equal(deriveArrivalStatus('Arrived', minutesFromNow(-10)), 'departed');
  });

  test('with no source status, a flight well past its estimated arrival is treated as landed', () => {
    assert.equal(deriveArrivalStatus(undefined, minutesFromNow(-45)), 'departed');
  });

  test('with no source status and not yet due, stays "scheduled" (never final_call/gate_closed)', () => {
    assert.equal(deriveArrivalStatus(undefined, minutesFromNow(3)), 'scheduled');
    assert.equal(deriveArrivalStatus(undefined, minutesFromNow(60)), 'scheduled');
  });
});

describe('findQuickTurns', () => {
  function flight(reg: string, arrivalUtc?: string, departureUtc?: string, gate?: string, terminal?: string): AeroDataBoxFlight {
    return {
      aircraft: { reg },
      arrival: arrivalUtc ? { scheduledTime: { utc: arrivalUtc }, gate, terminal } : undefined,
      departure: departureUtc ? { scheduledTime: { utc: departureUtc } } : undefined,
    };
  }

  test('matches a departure to its own aircraft\'s recent arrival within 90 minutes', () => {
    const landedAt = new Date(Date.now() - 30 * 60_000).toISOString();
    const departsAt = new Date(Date.now() + 20 * 60_000).toISOString();
    const arrivals = [flight('VT-ABC', landedAt, undefined, '15', 'T1')];
    const departures = [flight('VT-ABC', undefined, departsAt)];

    const quickTurns = findQuickTurns(arrivals, departures);
    const match = quickTurns.get('VT-ABC');
    assert.ok(match, 'expected a quick-turn match for this registration');
    assert.equal(match!.arrivalGate, '15');
    assert.equal(match!.arrivalTerminal, 'T1');
  });

  test('does not match when the turnaround exceeds 90 minutes', () => {
    const landedAt = new Date(Date.now() - 150 * 60_000).toISOString();
    const departsAt = new Date().toISOString();
    const arrivals = [flight('VT-XYZ', landedAt, undefined, '20', 'T1')];
    const departures = [flight('VT-XYZ', undefined, departsAt)];

    const quickTurns = findQuickTurns(arrivals, departures);
    assert.equal(quickTurns.get('VT-XYZ'), undefined);
  });

  test('does not match a departure to an arrival that happens AFTER it (wrong direction)', () => {
    const departsAt = new Date().toISOString();
    const landedAt = new Date(Date.now() + 30 * 60_000).toISOString(); // arrival is in the future relative to departure
    const arrivals = [flight('VT-FUTURE', landedAt, undefined, '20', 'T1')];
    const departures = [flight('VT-FUTURE', undefined, departsAt)];

    const quickTurns = findQuickTurns(arrivals, departures);
    assert.equal(quickTurns.get('VT-FUTURE'), undefined);
  });

  test('different aircraft registrations never match each other', () => {
    const landedAt = new Date(Date.now() - 30 * 60_000).toISOString();
    const departsAt = new Date().toISOString();
    const arrivals = [flight('VT-AAA', landedAt, undefined, '10', 'T1')];
    const departures = [flight('VT-BBB', undefined, departsAt)];

    const quickTurns = findQuickTurns(arrivals, departures);
    assert.equal(quickTurns.size, 0);
  });
});
