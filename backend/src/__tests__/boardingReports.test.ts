import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { submitReport, getReportCounts, getAirportReportCounts } from '../services/boardingReports';

let counter = 0;
function uniqueId(label: string): string {
  counter += 1;
  return `TEST_${label}_${counter}`;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('per-flight report dedup', () => {
  test('the same reporter submitting repeatedly only ever counts once', () => {
    const flightId = uniqueId('flight');
    submitReport(flightId, 'board', 'aerobridge', 'N/A', 'reporter-1');
    submitReport(flightId, 'board', 'aerobridge', 'N/A', 'reporter-1');
    submitReport(flightId, 'board', 'aerobridge', 'N/A', 'reporter-1');
    assert.deepEqual(getReportCounts(flightId, 'board'), { aerobridge: 1 });
  });

  test('a reporter changing their mind moves their vote instead of adding a second one', () => {
    const flightId = uniqueId('flight');
    submitReport(flightId, 'board', 'aerobridge', 'N/A', 'reporter-1');
    submitReport(flightId, 'board', 'shuttle_bus', 'N/A', 'reporter-1');
    const counts = getReportCounts(flightId, 'board');
    assert.equal(counts.shuttle_bus, 1);
    assert.equal(counts.aerobridge, undefined);
  });

  test('different reporters on the same flight each count independently', () => {
    const flightId = uniqueId('flight');
    submitReport(flightId, 'board', 'aerobridge', 'N/A', 'reporter-1');
    submitReport(flightId, 'board', 'aerobridge', 'N/A', 'reporter-2');
    submitReport(flightId, 'board', 'shuttle_bus', 'N/A', 'reporter-3');
    assert.deepEqual(getReportCounts(flightId, 'board'), { aerobridge: 2, shuttle_bus: 1 });
  });

  test('board and deplane phases on the same flight are tracked independently', () => {
    const flightId = uniqueId('flight');
    submitReport(flightId, 'board', 'aerobridge', 'N/A', 'reporter-1');
    submitReport(flightId, 'deplane', 'shuttle_bus', 'N/A', 'reporter-1');
    assert.deepEqual(getReportCounts(flightId, 'board'), { aerobridge: 1 });
    assert.deepEqual(getReportCounts(flightId, 'deplane'), { shuttle_bus: 1 });
  });
});

describe('airport-level consensus dedup', () => {
  test("'N/A' airport is never tallied at the airport level (only the per-flight tally applies)", () => {
    const flightId = uniqueId('flight');
    submitReport(flightId, 'board', 'aerobridge', 'N/A', 'reporter-1');
    assert.deepEqual(getAirportReportCounts('N/A', 'board'), {});
  });

  test('the same reporter reporting on DIFFERENT flights at the same airport each count separately', () => {
    const airport = uniqueId('AIRPORT');
    submitReport(uniqueId('flight'), 'board', 'aerobridge', airport, 'frequent-flyer');
    submitReport(uniqueId('flight'), 'board', 'aerobridge', airport, 'frequent-flyer');
    submitReport(uniqueId('flight'), 'board', 'aerobridge', airport, 'frequent-flyer');
    assert.deepEqual(getAirportReportCounts(airport, 'board'), { aerobridge: 3 });
  });

  test('the same reporter repeating on the SAME flight only counts once toward the airport pool', () => {
    const airport = uniqueId('AIRPORT');
    const flightId = uniqueId('flight');
    submitReport(flightId, 'board', 'aerobridge', airport, 'reporter-1');
    submitReport(flightId, 'board', 'aerobridge', airport, 'reporter-1');
    submitReport(flightId, 'board', 'aerobridge', airport, 'reporter-1');
    assert.deepEqual(getAirportReportCounts(airport, 'board'), { aerobridge: 1 });
  });

  test('airport codes are case-insensitive', () => {
    const airport = uniqueId('airport').toLowerCase();
    submitReport(uniqueId('flight'), 'board', 'aerobridge', airport, 'reporter-1');
    assert.deepEqual(getAirportReportCounts(airport.toUpperCase(), 'board'), { aerobridge: 1 });
  });
});

describe('airport consensus vote decay', () => {
  test('a vote older than the 180-day window is excluded from the tally', () => {
    const airport = uniqueId('AIRPORT');
    const flightId = uniqueId('flight');
    const now = Date.now();
    const twoHundredDaysAgo = now - 200 * ONE_DAY_MS;

    submitReport(flightId, 'board', 'aerobridge', airport, 'old-reporter', twoHundredDaysAgo);
    // Tally "as of now" (the default) - the vote is already too old.
    assert.deepEqual(getAirportReportCounts(airport, 'board', now), {});
  });

  test('a vote within the 180-day window still counts', () => {
    const airport = uniqueId('AIRPORT');
    const flightId = uniqueId('flight');
    const now = Date.now();
    const tenDaysAgo = now - 10 * ONE_DAY_MS;

    submitReport(flightId, 'board', 'shuttle_bus', airport, 'recent-reporter', tenDaysAgo);
    assert.deepEqual(getAirportReportCounts(airport, 'board', now), { shuttle_bus: 1 });
  });

  test('an old vote is correctly excluded even when a recent vote from someone else coexists', () => {
    const airport = uniqueId('AIRPORT');
    const now = Date.now();
    const twoHundredDaysAgo = now - 200 * ONE_DAY_MS;
    const tenDaysAgo = now - 10 * ONE_DAY_MS;

    submitReport(uniqueId('flight'), 'board', 'aerobridge', airport, 'stale-reporter', twoHundredDaysAgo);
    submitReport(uniqueId('flight'), 'board', 'shuttle_bus', airport, 'fresh-reporter', tenDaysAgo);

    assert.deepEqual(getAirportReportCounts(airport, 'board', now), { shuttle_bus: 1 });
  });
});
