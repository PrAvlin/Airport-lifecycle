import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatIstTime, formatTimeInZone, formatDuration } from '../utils/time';

describe('formatIstTime', () => {
  test('always appends the "IST" suffix', () => {
    assert.ok(formatIstTime('2024-06-01T10:00:00Z').endsWith('IST'));
  });

  test('two instants exactly 24 hours apart show the same wall-clock time (locale-format-agnostic check)', () => {
    const a = formatIstTime('2024-06-01T10:00:00Z');
    const b = formatIstTime('2024-06-02T10:00:00Z');
    assert.equal(a, b);
  });

  test('accepts a Date object directly, not just an ISO string', () => {
    const result = formatIstTime(new Date('2024-06-01T10:00:00Z'));
    assert.ok(result.endsWith('IST'));
  });

  test('a half-hour UTC shift produces a different displayed time', () => {
    const a = formatIstTime('2024-06-01T10:00:00Z');
    const b = formatIstTime('2024-06-01T10:30:00Z');
    assert.notEqual(a, b);
  });
});

describe('formatTimeInZone', () => {
  test('formats correctly for a valid IANA timezone', () => {
    const result = formatTimeInZone('2024-06-01T10:00:00Z', 'America/New_York');
    assert.match(result, /\d{1,2}:\d{2}/);
  });

  test('falls back gracefully (no throw) for an invalid timezone string', () => {
    assert.doesNotThrow(() => formatTimeInZone('2024-06-01T10:00:00Z', 'Not/ARealZone'));
    const result = formatTimeInZone('2024-06-01T10:00:00Z', 'Not/ARealZone');
    assert.match(result, /\d{1,2}:\d{2}/);
  });
});

describe('formatDuration', () => {
  test('formats a sub-hour duration as minutes only', () => {
    assert.equal(formatDuration('2024-06-01T10:00:00Z', '2024-06-01T10:45:00Z'), '45m');
  });

  test('formats an exact-hour duration with 0 minutes', () => {
    assert.equal(formatDuration('2024-06-01T10:00:00Z', '2024-06-01T11:00:00Z'), '1h 0m');
  });

  test('formats a multi-hour duration with both parts', () => {
    assert.equal(formatDuration('2024-06-01T10:00:00Z', '2024-06-01T12:10:00Z'), '2h 10m');
  });

  test('a zero or negative duration (bad data) renders as "—" rather than a nonsense negative time', () => {
    assert.equal(formatDuration('2024-06-01T10:00:00Z', '2024-06-01T10:00:00Z'), '—');
    assert.equal(formatDuration('2024-06-01T10:00:00Z', '2024-06-01T09:00:00Z'), '—');
  });
});
