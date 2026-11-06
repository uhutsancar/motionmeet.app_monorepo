// Read-path load rehearsal: Keşfet and home feed pages for signed-in members.
//
// Point it at a disposable stack, never at production:
//   docker run --rm -i --network motionmeet_prod_edge -e BASE_URL=http://web:8080 \
//     -v "$PWD/scripts/load:/load" grafana/k6 run /load/feed-read.k6.js
//
// Registration is limited to five per hour per address, so the script signs up
// two members once and shares their tokens across virtual users; the access
// token lives fifteen minutes, longer than the run.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8088";
// TOKENS_FILE: a JSON array of access tokens for many seeded members, so most
// requests miss the per-member feed cache as real traffic does. Only for a
// disposable stack whose JWT secret is known (docker-compose.local.yml).
const PRESET_TOKENS = __ENV.TOKENS_FILE ? JSON.parse(open(__ENV.TOKENS_FILE)) : null;
const JSON_HEADERS = { "Content-Type": "application/json", "X-Client-Platform": "mobile" };

export const options = {
  scenarios: {
    // About 35 requests a second at the defaults: comfortably under the
    // per-address global rate limit, so the run measures latency, not 429s.
    feed: { executor: "constant-vus", vus: Number(__ENV.VUS || 10), duration: __ENV.DURATION || "30s" },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:feed_discover}": ["p(95)<350"],
    "http_req_duration{endpoint:feed_following}": ["p(95)<350"],
  },
};

const signUp = (suffix) => {
  const credentials = { email: `load-${suffix}@example.test`, password: "load-test-password-1", full_name: "Load Test", username: `load_${suffix}` };
  http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(credentials), { headers: JSON_HEADERS });
  const login = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email: credentials.email, password: credentials.password }), { headers: JSON_HEADERS });
  const token = login.json("token");
  if (!token) throw new Error(`login failed with ${login.status}`);
  return token;
};

const logIn = (email, password) => {
  const login = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email, password }), { headers: JSON_HEADERS });
  const token = login.json("token");
  if (!token) throw new Error(`login failed with ${login.status}`);
  return token;
};

// EMAILS=member10000@synthetic.test,member500@synthetic.test PASSWORD=synthetic-password-1
// reads as members of the seeded graph (scripts/load/seed-synthetic.sql) instead
// of two fresh accounts that follow nobody.
export function setup() {
  if (PRESET_TOKENS) return { tokens: PRESET_TOKENS };
  if (__ENV.EMAILS) return { tokens: __ENV.EMAILS.split(",").map((email) => logIn(email.trim(), __ENV.PASSWORD)) };
  const run = Date.now().toString(36);
  return { tokens: [signUp(`${run}a`), signUp(`${run}b`)] };
}

export default function ({ tokens }) {
  const headers = { Authorization: `Bearer ${tokens[Math.floor(Math.random() * tokens.length)]}` };
  const discover = http.get(`${BASE_URL}/api/post/feed?mode=discover&limit=20`, { headers, tags: { endpoint: "feed_discover" } });
  check(discover, { "discover 200": (response) => response.status === 200 });
  const following = http.get(`${BASE_URL}/api/post/feed?mode=following&limit=20`, { headers, tags: { endpoint: "feed_following" } });
  check(following, { "following 200": (response) => response.status === 200 });
  sleep(0.5);
}
