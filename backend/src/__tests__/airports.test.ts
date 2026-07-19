import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ORIGIN_AIRPORTS } from '../data/airports';

// Turns the one-off validation script (run manually during a prior QC pass)
// into a permanent regression check, so a future edit to airports.ts that
// breaks a cross-reference (e.g. a gateRule pointing at a terminal that got
// renamed) fails a test run instead of surfacing as a silent runtime bug the
// next time someone happens to search a flight at that specific gate.
describe('airport data integrity', () => {
  for (const airport of Object.values(ORIGIN_AIRPORTS)) {
    test(`${airport.iata}: defaultTerminal exists in its own terminals map`, () => {
      assert.ok(
        Object.keys(airport.terminals).includes(airport.defaultTerminal),
        `${airport.iata}'s defaultTerminal '${airport.defaultTerminal}' isn't one of its own terminals: ${Object.keys(airport.terminals)}`,
      );
    });

    test(`${airport.iata}: every gateRule references a real terminal, with no conflicting gate assignments`, () => {
      const terminalKeys = Object.keys(airport.terminals);
      const gateOwner = new Map<string, string>();

      for (const rule of airport.gateRules) {
        assert.ok(
          terminalKeys.includes(rule.terminal),
          `${airport.iata} gateRule references unknown terminal '${rule.terminal}'`,
        );
        assert.ok(
          rule.probability >= 0 && rule.probability <= 1,
          `${airport.iata} gateRule probability out of range: ${rule.probability}`,
        );
        for (const gate of rule.gates) {
          const key = `${rule.terminal}:${gate}`;
          const existing = gateOwner.get(key);
          assert.ok(
            !existing || existing === rule.method,
            `${airport.iata} gate ${key} is assigned conflicting methods: '${existing}' and '${rule.method}'`,
          );
          gateOwner.set(key, rule.method);
        }
      }
    });

    test(`${airport.iata}: every terminal profile has a valid aerobridgeShare`, () => {
      for (const [terminalId, profile] of Object.entries(airport.terminals)) {
        assert.ok(
          profile.aerobridgeShare >= 0 && profile.aerobridgeShare <= 1,
          `${airport.iata} ${terminalId} aerobridgeShare out of range: ${profile.aerobridgeShare}`,
        );
      }
    });

    test(`${airport.iata}: has valid coordinates and a positive typical flight time`, () => {
      assert.ok(Number.isFinite(airport.latitude) && Number.isFinite(airport.longitude));
      assert.ok(Number.isFinite(airport.typicalFlightMinutes) && airport.typicalFlightMinutes > 0);
    });

    test(`${airport.iata}: every locality has valid coordinates and a positive typical drive time`, () => {
      for (const loc of airport.localities) {
        assert.ok(
          Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude),
          `${airport.iata} locality '${loc.id}' has bad coordinates`,
        );
        assert.ok(
          Number.isFinite(loc.typicalMinutesNoTraffic) && loc.typicalMinutesNoTraffic > 0,
          `${airport.iata} locality '${loc.id}' has a bad typicalMinutesNoTraffic`,
        );
      }
    });
  }

  test('at least the core launch airports (BLR, MAA, CJB) are present', () => {
    for (const iata of ['BLR', 'MAA', 'CJB']) {
      assert.ok(ORIGIN_AIRPORTS[iata], `expected ${iata} in ORIGIN_AIRPORTS`);
    }
  });
});
