import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeLeaveByTime } from '../utils/leaveBy';
import { FlightState, TrafficEstimate } from '../types';

// computeLeaveByTime only reads flight.checkpoints.security.estimatedWaitMinutes
// and flight.boardingStartTime, plus traffic.durationMinutes - this fixture
// only fills in what the function actually touches, cast through `unknown`
// rather than padding out FlightState's full real-world shape with unused
// filler fields that would just be noise here.
function fixtureFlight(boardingStartTime: string, securityWaitMinutes: number): FlightState {
  return {
    boardingStartTime,
    checkpoints: { security: { name: 'Security', estimatedWaitMinutes: securityWaitMinutes } },
  } as unknown as FlightState;
}

function fixtureTraffic(durationMinutes: number): TrafficEstimate {
  return { durationMinutes } as unknown as TrafficEstimate;
}

describe('computeLeaveByTime', () => {
  test('subtracts drive time + security wait + the fixed terminal buffer from boarding start', () => {
    const boardingStart = '2024-06-01T10:00:00.000Z';
    const flight = fixtureFlight(boardingStart, 15); // 15 min security
    const traffic = fixtureTraffic(30); // 30 min drive

    const leaveBy = computeLeaveByTime(flight, traffic);
    // 30 (drive) + 15 (security) + 20 (fixed terminal buffer) = 65 minutes before boarding.
    const expected = new Date(new Date(boardingStart).getTime() - 65 * 60_000);
    assert.equal(leaveBy.getTime(), expected.getTime());
  });

  test('a longer drive time pushes the recommended leave time earlier', () => {
    const boardingStart = '2024-06-01T10:00:00.000Z';
    const shortDrive = computeLeaveByTime(fixtureFlight(boardingStart, 10), fixtureTraffic(20));
    const longDrive = computeLeaveByTime(fixtureFlight(boardingStart, 10), fixtureTraffic(60));
    assert.ok(longDrive.getTime() < shortDrive.getTime(), 'a longer commute should recommend leaving earlier');
  });

  test('a longer security wait also pushes the recommended leave time earlier', () => {
    const boardingStart = '2024-06-01T10:00:00.000Z';
    const shortSecurity = computeLeaveByTime(fixtureFlight(boardingStart, 10), fixtureTraffic(30));
    const longSecurity = computeLeaveByTime(fixtureFlight(boardingStart, 30), fixtureTraffic(30));
    assert.ok(longSecurity.getTime() < shortSecurity.getTime(), 'a longer security wait should recommend leaving earlier');
  });
});
