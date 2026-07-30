import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeLeaveByTime } from '../utils/leaveBy';
import { FlightState, TrafficEstimate } from '../types';

// computeLeaveByTime only reads flight.checkpoints.security.estimatedWaitMinutes
// and flight.estimatedDeparture, plus traffic.durationMinutes - this fixture
// only fills in what the function actually touches, cast through `unknown`
// rather than padding out FlightState's full real-world shape with unused
// filler fields that would just be noise here.
function fixtureFlight(estimatedDeparture: string, securityWaitMinutes: number): FlightState {
  return {
    estimatedDeparture,
    checkpoints: { security: { name: 'Security', estimatedWaitMinutes: securityWaitMinutes } },
  } as unknown as FlightState;
}

function fixtureTraffic(durationMinutes: number): TrafficEstimate {
  return { durationMinutes } as unknown as TrafficEstimate;
}

describe('computeLeaveByTime', () => {
  test('defaults to the most conservative assumption (not checked in, 60-min counter cutoff) when no status is given', () => {
    const departure = '2024-06-01T10:00:00.000Z';
    const flight = fixtureFlight(departure, 15); // 15 min security
    const traffic = fixtureTraffic(30); // 30 min drive

    const leaveBy = computeLeaveByTime(flight, traffic);
    // Required-at-airport-by = departure - 60 (counter cutoff). Then subtract
    // 30 (drive) + 15 (security) + 20 (fixed terminal buffer) = 65 minutes.
    const expected = new Date(new Date(departure).getTime() - (60 + 65) * 60_000);
    assert.equal(leaveBy.getTime(), expected.getTime());
  });

  test('"checked in with bags" uses the 45-minute bag-drop cutoff instead of the 60-minute counter cutoff', () => {
    const departure = '2024-06-01T10:00:00.000Z';
    const flight = fixtureFlight(departure, 15);
    const traffic = fixtureTraffic(30);

    const leaveBy = computeLeaveByTime(flight, traffic, 'checked_in_with_bags');
    const expected = new Date(new Date(departure).getTime() - (45 + 65) * 60_000);
    assert.equal(leaveBy.getTime(), expected.getTime());
  });

  test('"checked in, no bags" only needs to clear the ~25-minute gate-close cutoff', () => {
    const departure = '2024-06-01T10:00:00.000Z';
    const flight = fixtureFlight(departure, 15);
    const traffic = fixtureTraffic(30);

    const leaveBy = computeLeaveByTime(flight, traffic, 'checked_in_no_bags');
    const expected = new Date(new Date(departure).getTime() - (25 + 65) * 60_000);
    assert.equal(leaveBy.getTime(), expected.getTime());
  });

  test('not checked in recommends leaving earlier than checked-in-with-bags, which recommends leaving earlier than checked-in-no-bags', () => {
    const departure = '2024-06-01T10:00:00.000Z';
    const flight = fixtureFlight(departure, 15);
    const traffic = fixtureTraffic(30);

    const notCheckedIn = computeLeaveByTime(flight, traffic, 'not_checked_in');
    const withBags = computeLeaveByTime(flight, traffic, 'checked_in_with_bags');
    const noBags = computeLeaveByTime(flight, traffic, 'checked_in_no_bags');

    assert.ok(notCheckedIn.getTime() < withBags.getTime(), 'not checked in should recommend leaving earliest');
    assert.ok(withBags.getTime() < noBags.getTime(), 'checked in with bags should still recommend leaving earlier than no-bags');
  });

  test('a longer drive time pushes the recommended leave time earlier', () => {
    const departure = '2024-06-01T10:00:00.000Z';
    const shortDrive = computeLeaveByTime(fixtureFlight(departure, 10), fixtureTraffic(20));
    const longDrive = computeLeaveByTime(fixtureFlight(departure, 10), fixtureTraffic(60));
    assert.ok(longDrive.getTime() < shortDrive.getTime(), 'a longer commute should recommend leaving earlier');
  });

  test('a longer security wait also pushes the recommended leave time earlier', () => {
    const departure = '2024-06-01T10:00:00.000Z';
    const shortSecurity = computeLeaveByTime(fixtureFlight(departure, 10), fixtureTraffic(30));
    const longSecurity = computeLeaveByTime(fixtureFlight(departure, 30), fixtureTraffic(30));
    assert.ok(longSecurity.getTime() < shortSecurity.getTime(), 'a longer security wait should recommend leaving earlier');
  });
});
