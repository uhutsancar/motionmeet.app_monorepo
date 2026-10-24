import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import test from 'node:test';
import tls from 'node:tls';
import zlib from 'node:zlib';

/*
 * Behaviour the API depends on from the Node.js runtime itself, checked on the
 * binary that runs the suite. Several assertions here only hold on a release
 * that carries the October 2026 security fixes, so an unpatched runtime fails
 * them; the version gate (check-node-security.mjs) is still the primary proof.
 * Nothing here is an exploit: every input is well-formed or plainly invalid.
 */

test('Brotli round-trips text, binary and empty payloads', () => {
  const payloads = [
    Buffer.from('MotionMeet — antrenman özeti ✓'.repeat(64), 'utf8'),
    Buffer.from(Array.from({ length: 4096 }, (_, index) => (index * 31) % 256)),
    Buffer.alloc(0),
  ];
  for (const payload of payloads) {
    assert.deepEqual(zlib.brotliDecompressSync(zlib.brotliCompressSync(payload)), payload);
  }
});

test('Brotli streams in chunks and honours an output ceiling', async () => {
  const source = Buffer.from('set '.repeat(50_000));
  const compressed = zlib.brotliCompressSync(source);
  const chunks = Array.from({ length: Math.ceil(compressed.length / 7) }, (_, index) => compressed.subarray(index * 7, index * 7 + 7));
  const decompressed = await text(Readable.from(chunks).pipe(zlib.createBrotliDecompress()));
  assert.equal(decompressed, source.toString());
  assert.throws(() => zlib.brotliDecompressSync(compressed, { maxOutputLength: 1024 }), { code: 'ERR_BUFFER_TOO_LARGE' });
});

test('Brotli rejects input that is not a Brotli stream with a catchable error', () => {
  assert.throws(() => zlib.brotliDecompressSync(Buffer.from('this is not brotli data')), (error) => error instanceof Error && typeof error.code === 'string');
});

test('a DNS-only certificate does not authenticate a non-canonical IPv4 host (CVE-2026-106069, CVE-2026-106072)', () => {
  for (const host of ['127.1', '0127.0.0.1']) {
    const error = tls.checkServerIdentity(host, { subject: {}, subjectaltname: `DNS:${host}` });
    assert.ok(error instanceof Error, `${host} was accepted against a DNS SAN`);
    assert.equal(error.code, 'ERR_TLS_CERT_ALTNAME_INVALID');
  }
});

test('certificate identity checks still accept matching names and IP SANs', () => {
  assert.equal(tls.checkServerIdentity('example.com', { subject: {}, subjectaltname: 'DNS:example.com' }), undefined);
  assert.equal(tls.checkServerIdentity('127.0.0.1', { subject: {}, subjectaltname: 'IP Address:127.0.0.1' }), undefined);
  assert.ok(tls.checkServerIdentity('example.org', { subject: {}, subjectaltname: 'DNS:example.com' }) instanceof Error);
});

test('TLS certificate verification has not been switched off', () => {
  assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED, '0');
  assert.notEqual(https.globalAgent.options.rejectUnauthorized, false);
});

test('a hostname containing a NUL byte is refused before any query is sent (CVE-2026-105482)', async () => {
  const resolver = new dns.promises.Resolver({ timeout: 250, tries: 1 });
  // Port 9 on loopback answers nothing; a runtime that sends the query anyway
  // fails with a network error instead of the argument error asserted here.
  resolver.setServers(['127.0.0.1:9']);
  // A patched runtime throws synchronously; the wrapper turns that into a rejection.
  await assert.rejects(async () => resolver.resolve4('motionmeet.invalid\0.example'), { code: 'ERR_INVALID_ARG_VALUE' });
});

test('keep-alive connections pair every response with its own request (CVE-2026-105481)', async () => {
  const server = http.createServer((request, response) => {
    // Answer out of order so a mispaired response would be visible.
    setTimeout(() => response.end(request.url), Math.floor(Math.random() * 5));
  });
  server.keepAliveTimeout = 5_000;
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const agent = new http.Agent({ keepAlive: true, maxSockets: 2 });
  try {
    const { port } = server.address();
    const ids = Array.from({ length: 40 }, () => `/${randomUUID()}`);
    const bodies = await Promise.all(ids.map((id) => new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: id, agent }, async (response) => resolve(await text(response))).on('error', reject);
    })));
    assert.deepEqual(bodies, ids);
  } finally {
    agent.destroy();
    server.close();
  }
});

test('randomUUID does not repeat within a process', () => {
  const ids = new Set(Array.from({ length: 20_000 }, () => randomUUID()));
  assert.equal(ids.size, 20_000);
});
