import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit } from '../middleware/reportRateLimit';

let counter = 0;
function uniqueKey(): string {
  counter += 1;
  return `test-ip-${counter}`;
}

describe('checkRateLimit', () => {
  test('allows up to the per-window cap', () => {
    const key = uniqueKey();
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      const result = checkRateLimit(key, now);
      assert.equal(result.allowed, true, `request ${i + 1} should be allowed`);
    }
  });

  test('blocks the request right after the cap, with a Retry-After estimate', () => {
    const key = uniqueKey();
    const now = Date.now();
    for (let i = 0; i < 10; i++) checkRateLimit(key, now);
    const blocked = checkRateLimit(key, now + 1000);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds! > 0 && blocked.retryAfterSeconds! <= 60);
  });

  test('a new window (60s later) resets the count', () => {
    const key = uniqueKey();
    const now = Date.now();
    for (let i = 0; i < 10; i++) checkRateLimit(key, now);
    assert.equal(checkRateLimit(key, now + 1000).allowed, false, 'still within the same window');
    assert.equal(checkRateLimit(key, now + 61_000).allowed, true, 'a new window should reset the count');
  });

  test('different keys (callers) are tracked completely independently', () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();
    const now = Date.now();
    for (let i = 0; i < 10; i++) checkRateLimit(keyA, now);
    assert.equal(checkRateLimit(keyA, now).allowed, false, 'keyA should now be limited');
    assert.equal(checkRateLimit(keyB, now).allowed, true, 'keyB must be unaffected by keyA being limited');
  });
});
