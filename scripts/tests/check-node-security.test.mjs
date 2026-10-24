import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  evaluateNodeVersion,
  scanDockerfile,
  scanEngines,
  scanRepository,
  scanWorkflow,
} from '../check-node-security.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'check-node-security.mjs');

test('releases older than the October 2026 security release are rejected', () => {
  for (const version of ['22.23.3', '24.22.0', '22.22.0', 'v24.15.0']) {
    assert.equal(evaluateNodeVersion(version).ok, false, version);
  }
});

test('the patched releases and later patches on the same line are accepted', () => {
  for (const version of ['22.23.4', '24.22.1', 'v24.22.1', '22.24.0', '24.23.0']) {
    assert.equal(evaluateNodeVersion(version).ok, true, version);
  }
});

test('unsupported lines and non-exact versions are rejected', () => {
  for (const version of ['23.11.0', '25.1.0', '26.12.1', '20.19.0', '24', 'lts', '']) {
    assert.equal(evaluateNodeVersion(version).ok, false, version);
  }
});

test('the CLI exits non-zero for an unpatched version and zero for a patched one', () => {
  const run = (version) => spawnSync(process.execPath, [script, `--version=${version}`], { encoding: 'utf8' }).status;
  assert.equal(run('22.23.3'), 1);
  assert.equal(run('24.22.0'), 1);
  assert.equal(run('22.23.4'), 0);
  assert.equal(run('24.22.1'), 0);
});

test('Dockerfiles must pin every Node stage to an exact patched release', () => {
  assert.deepEqual(scanDockerfile('FROM node:24.22.1-alpine AS build\nFROM nginxinc/nginx-unprivileged:stable-alpine', 'ok').failures, []);
  assert.deepEqual(scanDockerfile(`FROM node:24.22.1-alpine@sha256:${'a'.repeat(64)} AS runtime`, 'digest').failures, []);
  for (const line of ['FROM node:24-alpine', 'FROM node:24', 'FROM node:lts-alpine', 'FROM docker.io/library/node:22-alpine AS x', 'FROM node:24.22.0-alpine', 'FROM --platform=linux/amd64 node:22.23.3-alpine']) {
    assert.equal(scanDockerfile(line, 'bad').failures.length, 1, line);
  }
  const multiStage = 'FROM node:24.22.1-alpine AS build\nRUN true\nFROM node:24-alpine AS runtime';
  assert.equal(scanDockerfile(multiStage, 'multi').failures.length, 1, 'one floating stage among patched ones is still caught');
});

test('workflow node-version values must be exact patched releases', () => {
  assert.deepEqual(scanWorkflow('      - uses: actions/setup-node@v6\n        with:\n          node-version: "22.23.4"', 'ci').failures, []);
  assert.deepEqual(scanWorkflow('        node-version: ["22.23.4", "24.22.1"]\n          node-version: ${{ matrix.node-version }}', 'ci').failures, []);
  assert.equal(scanWorkflow('          node-version: "22"', 'ci').failures.length, 1);
  assert.equal(scanWorkflow('        node-version: ["22.23.4", "24.21.0"]', 'ci').failures.length, 1);
});

test('engines.node must admit only patched releases of bounded lines', () => {
  assert.deepEqual(scanEngines('>=22.23.4 <23 || >=24.22.1 <25').failures, []);
  assert.equal(scanEngines('>=22.22.0').failures.length, 1);
  assert.equal(scanEngines('>=22.23.4').failures.length, 1);
  assert.equal(scanEngines('>=22.23.4 <25').failures.length, 1);
  assert.equal(scanEngines(undefined).failures.length, 1);
});

test('this repository passes its own scan', async () => {
  const result = await scanRepository();
  assert.deepEqual(result.failures, []);
  assert.ok(result.dockerStages.length >= 7, 'every Node stage in packages/*/Dockerfile* was found');
});
