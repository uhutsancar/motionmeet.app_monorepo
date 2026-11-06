import assert from "node:assert/strict";
import test from "node:test";
import { allowedMediaHosts, fetchImageBounded, isAllowedMediaUrl } from "../utils/boundedFetch.js";

const HOSTS = allowedMediaHosts({ IMAGEKIT_URL_ENDPOINT: "https://ik.imagekit.io/motionmeet/" } as NodeJS.ProcessEnv);
const PHOTO = "https://ik.imagekit.io/motionmeet/posts/u1/photo.jpg";

/** A fetch stand-in that streams `chunks` and reports `headers`. */
const fakeFetch = (chunks: Uint8Array[], headers: Record<string, string> = { "content-type": "image/jpeg" }, status = 200) => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const next = chunks.shift();
        if (next) controller.enqueue(next);
        else controller.close();
      },
    });
    return new Response(body, { status, headers });
  }) as unknown as typeof fetch;
  return { impl, calls };
};

test("only https URLs on a configured media host, without credentials, are fetched", () => {
  assert.equal(isAllowedMediaUrl(PHOTO, HOSTS), true);
  for (const url of [
    "http://ik.imagekit.io/motionmeet/a.jpg",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/a.jpg",
    "https://user:pass@ik.imagekit.io/a.jpg",
    "https://ik.imagekit.io.evil.example/a.jpg",
    "file:///etc/passwd",
    "not a url",
  ]) {
    assert.equal(isAllowedMediaUrl(url, HOSTS), false, url);
  }
});

test("with no media host configured nothing is allowed", () => {
  assert.equal(allowedMediaHosts({} as NodeJS.ProcessEnv).size, 0);
  assert.equal(isAllowedMediaUrl(PHOTO, allowedMediaHosts({} as NodeJS.ProcessEnv)), false);
});

test("a disallowed URL is never requested", async () => {
  const { impl, calls } = fakeFetch([new Uint8Array(4)]);
  const result = await fetchImageBounded("https://10.0.0.5/a.jpg", { maxBytes: 100, timeoutMs: 1000, hosts: HOSTS, fetchImpl: impl });
  assert.equal(result, null);
  assert.equal(calls.length, 0);
});

test("redirects are refused rather than followed", async () => {
  const { impl, calls } = fakeFetch([new Uint8Array(4)]);
  await fetchImageBounded(PHOTO, { maxBytes: 100, timeoutMs: 1000, hosts: HOSTS, fetchImpl: impl });
  assert.equal(calls[0]?.init?.redirect, "error");
});

test("a body over the limit is cut off even without a Content-Length", async () => {
  const { impl } = fakeFetch([new Uint8Array(60), new Uint8Array(60)]);
  const result = await fetchImageBounded(PHOTO, { maxBytes: 100, timeoutMs: 1000, hosts: HOSTS, fetchImpl: impl });
  assert.equal(result, null);
});

test("a body that lies about its Content-Length is still cut off", async () => {
  const { impl } = fakeFetch([new Uint8Array(80), new Uint8Array(80)], { "content-type": "image/png", "content-length": "10" });
  assert.equal(await fetchImageBounded(PHOTO, { maxBytes: 100, timeoutMs: 1000, hosts: HOSTS, fetchImpl: impl }), null);
});

test("a declared size over the limit is refused before reading", async () => {
  const { impl } = fakeFetch([new Uint8Array(4)], { "content-type": "image/png", "content-length": "5000" });
  assert.equal(await fetchImageBounded(PHOTO, { maxBytes: 100, timeoutMs: 1000, hosts: HOSTS, fetchImpl: impl }), null);
});

test("a non-image response is refused", async () => {
  const { impl } = fakeFetch([new Uint8Array(4)], { "content-type": "text/html" });
  assert.equal(await fetchImageBounded(PHOTO, { maxBytes: 100, timeoutMs: 1000, hosts: HOSTS, fetchImpl: impl }), null);
});

test("an image within the limit comes back whole", async () => {
  const { impl } = fakeFetch([new Uint8Array([1, 2]), new Uint8Array([3])]);
  const result = await fetchImageBounded(PHOTO, { maxBytes: 100, timeoutMs: 1000, hosts: HOSTS, fetchImpl: impl });
  assert.deepEqual(result && [...result], [1, 2, 3]);
});
