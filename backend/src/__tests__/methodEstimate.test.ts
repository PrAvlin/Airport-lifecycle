import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { boardingInputs, disembarkInputs, quickTurnInputs, estimateAndRegister, recomputeEstimate } from '../services/methodEstimate';
import { submitReport } from '../services/boardingReports';
import { getOriginAirport, OriginAirport } from '../data/airports';

// Every methodEstimate test uses a fresh, unique flightId/airport code per
// case so tests can't contaminate each other via the shared in-memory report
// maps in boardingReports.ts (there's no reset-between-tests hook, since the
// module is a real singleton store just like it is in the running server).
let counter = 0;
function uniqueId(label: string): string {
  counter += 1;
  return `TEST_${label}_${counter}`;
}

// A deliberately minimal, self-contained airport fixture with NO gate rules
// of its own - unlike getOriginAirport(unknownCode), which silently falls
// back to BLR's real data (and BLR's own real, unrelated gate rules/consensus
// history) for any code it doesn't recognize. Using that fallback here would
// make these tests accidentally exercise BLR instead of an isolated fixture.
function fakeAirport(iata: string): OriginAirport {
  return {
    iata,
    icao: 'ZZZZ',
    name: 'Test Fixture Airport',
    city: 'Test City',
    latitude: 0,
    longitude: 0,
    timezone: 'Asia/Kolkata',
    typicalFlightMinutes: 90,
    terminals: { T1: { aerobridgeShare: 0.5, reason: 'test fixture default profile' } },
    defaultTerminal: 'T1',
    gateRules: [],
    localities: [],
  };
}

describe('boardingInputs: gate-rule priority', () => {
  test('a known ground-level bus gate overrides the terminal base rate', () => {
    const blr = getOriginAirport('BLR');
    // Per the real BLR T1 gate map (airports.ts): gates 3-9 are ground-level bus gates.
    const inputs = boardingInputs(blr, 'T1', '5');
    assert.ok(inputs.baseAerobridgeProb < 0.5, 'a bus gate should skew heavily toward shuttle_bus');
    assert.match(inputs.baseReasons[0], /bus gate/i);
  });

  test('a known upper-level aerobridge gate overrides the terminal base rate', () => {
    const blr = getOriginAirport('BLR');
    // Gates 12-18 are upper-level aerobridge gates.
    const inputs = boardingInputs(blr, 'T1', '15');
    assert.ok(inputs.baseAerobridgeProb > 0.5, 'an aerobridge gate should skew heavily toward aerobridge');
    assert.match(inputs.baseReasons[0], /aerobridge/i);
  });

  test('an unmapped/TBD gate falls back to the terminal-wide profile, not a gate rule', () => {
    const airport = fakeAirport(uniqueId('AIRPORT'));
    const inputs = boardingInputs(airport, 'T1', 'TBD');
    assert.equal(inputs.baseAerobridgeProb, airport.terminals.T1.aerobridgeShare);
    assert.equal(inputs.baseReasons[0], airport.terminals.T1.reason);
  });
});

describe('quickTurnInputs', () => {
  test('inherits the arrival gate rule for a fast-turnaround aircraft', () => {
    const blr = getOriginAirport('BLR');
    const inputs = quickTurnInputs(blr, 'T1', '5'); // gate 5 = shuttle_bus
    assert.ok(inputs, 'expected a quick-turn signal from a known gate rule');
    assert.ok(inputs!.baseAerobridgeProb < 0.5);
    assert.match(inputs!.baseReasons[0], /quick turnarounds/i);
  });

  test('returns undefined when the arrival gate has no known rule (caller must fall back)', () => {
    const blr = getOriginAirport('BLR');
    const inputs = quickTurnInputs(blr, 'T1', 'TBD');
    assert.equal(inputs, undefined);
  });
});

describe('airport-level consensus', () => {
  test('does nothing below the minimum sample size', () => {
    const airportCode = uniqueId('AIRPORT');
    for (let i = 0; i < 4; i++) {
      submitReport(uniqueId('flight'), 'board', 'shuttle_bus', airportCode, `reporter-${i}`);
    }
    const inputs = boardingInputs(fakeAirport(airportCode), 'T1', 'TBD');
    assert.doesNotMatch(inputs.baseReasons[0], /passenger reports/i);
  });

  test('kicks in once the minimum sample size is reached, and reflects the majority', () => {
    const airportCode = uniqueId('AIRPORT');
    // 3 shuttle_bus + 2 aerobridge = 5 total, shuttle_bus leads.
    submitReport(uniqueId('f'), 'board', 'shuttle_bus', airportCode, 'r1');
    submitReport(uniqueId('f'), 'board', 'shuttle_bus', airportCode, 'r2');
    submitReport(uniqueId('f'), 'board', 'shuttle_bus', airportCode, 'r3');
    submitReport(uniqueId('f'), 'board', 'aerobridge', airportCode, 'r4');
    submitReport(uniqueId('f'), 'board', 'aerobridge', airportCode, 'r5');

    const inputs = boardingInputs(fakeAirport(airportCode), 'T1', 'TBD');
    assert.match(inputs.baseReasons[0], /5 passenger reports/);
    assert.match(inputs.baseReasons[0], /shuttle bus/);
    assert.ok(inputs.baseAerobridgeProb < 0.5, 'shuttle_bus majority should pull probability below 0.5');
  });

  test('a matched gate rule still wins over consensus even when consensus exists', () => {
    const blr = getOriginAirport('BLR');
    // Push BLR:board consensus heavily toward shuttle_bus using unique flight
    // ids so this doesn't collide with any other test's votes on BLR.
    for (let i = 0; i < 6; i++) {
      submitReport(uniqueId('f'), 'board', 'shuttle_bus', 'BLR', `consensus-priority-reporter-${i}`);
    }
    // Gate 15 is a real, curated aerobridge gate rule - it must still win.
    const inputs = boardingInputs(blr, 'T1', '15');
    assert.ok(inputs.baseAerobridgeProb > 0.5);
    assert.match(inputs.baseReasons[0], /Gate 15/);
  });
});

describe('confidence levels and the always-single-method invariant', () => {
  test('a strong base rate (>=75%) yields "likely" with a defined single method', () => {
    const flightId = uniqueId('flight');
    const estimate = estimateAndRegister(flightId, 'board', {
      baseAerobridgeProb: 0.95,
      baseReasons: ['test fixture'],
    });
    assert.equal(estimate.confidenceLevel, 'likely');
    assert.equal(estimate.method, 'aerobridge');
    assert.ok(estimate.probability >= 0.75);
  });

  test('a weak base rate (<75%) still names ONE method - "uncertain" never means no method', () => {
    const flightId = uniqueId('flight');
    const estimate = estimateAndRegister(flightId, 'board', {
      baseAerobridgeProb: 0.6,
      baseReasons: ['test fixture'],
    });
    assert.equal(estimate.confidenceLevel, 'uncertain');
    assert.ok(estimate.method === 'aerobridge' || estimate.method === 'shuttle_bus');
    assert.ok(estimate.probability >= 0.5 && estimate.probability < 0.75);
  });

  test('a base rate below 50% correctly flips the method to shuttle_bus', () => {
    const flightId = uniqueId('flight');
    const estimate = estimateAndRegister(flightId, 'board', {
      baseAerobridgeProb: 0.2,
      baseReasons: ['test fixture'],
    });
    assert.equal(estimate.method, 'shuttle_bus');
    assert.equal(estimate.probability, 0.8);
  });
});

describe('per-flight crowd reports: lock threshold', () => {
  test('a single caller repeating the same report cannot reach "confirmed" alone', () => {
    const flightId = uniqueId('flight');
    estimateAndRegister(flightId, 'board', { baseAerobridgeProb: 0.5, baseReasons: ['fixture'] });
    for (let i = 0; i < 3; i++) {
      submitReport(flightId, 'board', 'shuttle_bus', 'N/A', 'same-reporter');
    }
    const estimate = recomputeEstimate(flightId, 'board');
    assert.ok(estimate);
    assert.notEqual(estimate!.confidenceLevel, 'confirmed', 'one reporter repeating themselves must not lock in a result');
    assert.equal(estimate!.reportCounts.shuttle_bus, 1, 'repeat submissions from the same reporter must collapse to one vote');
  });

  test('3 distinct reporters agreeing locks the estimate as confirmed', () => {
    const flightId = uniqueId('flight');
    estimateAndRegister(flightId, 'deplane', { baseAerobridgeProb: 0.5, baseReasons: ['fixture'] });
    submitReport(flightId, 'deplane', 'aerobridge', 'N/A', 'reporter-a');
    submitReport(flightId, 'deplane', 'aerobridge', 'N/A', 'reporter-b');
    submitReport(flightId, 'deplane', 'aerobridge', 'N/A', 'reporter-c');

    const estimate = recomputeEstimate(flightId, 'deplane');
    assert.ok(estimate);
    assert.equal(estimate!.confidenceLevel, 'confirmed');
    assert.equal(estimate!.method, 'aerobridge');
    assert.equal(estimate!.probability, 1);
    assert.equal(estimate!.reportsToConfirm, 0);
  });
});

describe('disembarkInputs', () => {
  test('uses the destination airport gate rule when the destination is one of our own airports', () => {
    const inputs = disembarkInputs('BLR', 'T1', '15');
    assert.ok(inputs.baseAerobridgeProb > 0.5);
    assert.match(inputs.baseReasons[0], /Arrival gate 15/);
  });

  test('falls back to a genuine 0.5 toss-up for an unknown/uncurated airport with no gate info', () => {
    const inputs = disembarkInputs('ZZZ_NOT_A_REAL_AIRPORT');
    assert.equal(inputs.baseAerobridgeProb, 0.5, 'an unrecognized destination should be a genuine toss-up, not a guess dressed as fact');
  });
});
