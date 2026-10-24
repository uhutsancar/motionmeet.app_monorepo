import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAudit } from '../check-dependency-audit.mjs';

const advisory = (module_name, severity, github_advisory_id) => ({
  module_name,
  severity,
  github_advisory_id,
  patched_versions: '>=9.9.9',
  url: `https://github.com/advisories/${github_advisory_id}`,
  findings: [{ version: '1.0.0', paths: [`app>${module_name}`] }],
});
const report = (...advisories) => ({ advisories: Object.fromEntries(advisories.map((entry, index) => [index, entry])) });
const today = new Date('2026-10-24T12:00:00Z');
const exception = { ghsa: 'GHSA-2222-3333-4444', package: 'tool', reason: 'build-time only', expires: '2026-12-31' };

test('an unaccepted high or critical advisory fails the gate', () => {
  for (const severity of ['high', 'critical']) {
    assert.equal(evaluateAudit(report(advisory('lib', severity, 'GHSA-2222-3333-5555')), [], today).failures.length, 1);
  }
});

test('moderate and low advisories are reported but do not fail the gate', () => {
  const result = evaluateAudit(report(advisory('lib', 'moderate', 'GHSA-2222-3333-5555'), advisory('lib', 'low', 'GHSA-2222-3333-6666')), [], today);
  assert.deepEqual(result.failures, []);
  assert.equal(result.ungated.length, 2);
});

test('a reviewed exception accepts exactly its package and advisory', () => {
  const accepted = evaluateAudit(report(advisory('tool', 'high', exception.ghsa)), [exception], today);
  assert.deepEqual(accepted.failures, []);
  assert.equal(accepted.accepted.length, 1);
  const otherPackage = evaluateAudit(report(advisory('other', 'high', exception.ghsa)), [exception], today);
  assert.equal(otherPackage.failures.length, 1, 'an exception does not cover the same GHSA in another package');
});

test('an expired exception fails the gate again', () => {
  const result = evaluateAudit(report(advisory('tool', 'high', exception.ghsa)), [{ ...exception, expires: '2026-10-23' }], today);
  assert.ok(result.failures.some((failure) => failure.includes('expired')));
  assert.ok(result.failures.some((failure) => failure.includes('tool@1.0.0')));
});

test('exceptions without a reason or expiry are rejected, and stale ones are reported', () => {
  assert.equal(evaluateAudit(report(), [{ ghsa: exception.ghsa, package: 'tool' }], today).failures.length, 1);
  assert.deepEqual(evaluateAudit(report(), [exception], today).unusedExceptions, ['tool GHSA-2222-3333-4444']);
});
