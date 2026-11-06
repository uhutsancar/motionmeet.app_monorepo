import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

/**
 * Authorization sweep (BOLA/IDOR) against a running stack, through its public
 * HTTP surface - the same middleware, routes and serialisers a client hits.
 *
 *   E2E_BASE_URL=http://localhost:8088 pnpm --filter @motionmeet/backend test:e2e
 *
 * Three members: `owner` (private account), `follower` (approved), `stranger`.
 * The owner creates one of every resource that carries an id; the stranger
 * then tries to read, change and delete each by id. Positive controls (the
 * follower may see followers-only content, the owner sees their own) prove
 * that a denial is the access rule at work, not a broken setup.
 *
 * Registration is limited to five per hour per address; this suite registers
 * three members.
 */
const BASE = process.env.E2E_BASE_URL;
if (!BASE) throw new Error("Set E2E_BASE_URL to a disposable stack, e.g. http://localhost:8088");

interface Reply { status: number; body: Record<string, unknown> }
interface Member { id: string; token: string; username: string }

const call = async (method: string, path: string, { token, body, headers = {} }: { token?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Reply> => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { "X-Client-Platform": "mobile", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try { parsed = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { parsed = { raw: text.slice(0, 200) }; }
  return { status: response.status, body: parsed };
};

/** Refused: an error status, or the legacy `200 { success: false }` shape. */
const assertDenied = (reply: Reply, label: string): void => {
  const refused = reply.status >= 400 || reply.body.success === false;
  assert.ok(refused, `${label} must be refused, got ${reply.status} ${JSON.stringify(reply.body).slice(0, 160)}`);
  assert.ok(reply.status !== 500, `${label} must be refused cleanly, not with a server error`);
};
const assertOk = (reply: Reply, label: string): void => {
  assert.ok(reply.status < 300 && reply.body.success !== false, `${label} should succeed, got ${reply.status} ${JSON.stringify(reply.body).slice(0, 160)}`);
};

const run = randomUUID().slice(0, 6);
const member = async (name: string): Promise<Member> => {
  const credentials = { email: `${name}-${run}@example.test`, password: "authz-sweep-password-1", full_name: `Authz ${name}`, username: `authz_${name}_${run}` };
  const registered = await call("POST", "/api/auth/register", { body: credentials });
  assert.ok(registered.status === 201 || registered.status === 200, `register ${name}: ${registered.status} ${JSON.stringify(registered.body)}`);
  const login = await call("POST", "/api/auth/login", { body: { email: credentials.email, password: credentials.password } });
  assertOk(login, `login ${name}`);
  const me = await call("GET", "/api/auth/me", { token: login.body.token as string });
  const user = me.body.user as { _id?: string; id?: string };
  return { id: String(user._id ?? user.id), token: login.body.token as string, username: credentials.username };
};
const operation = (): Record<string, string> => ({ "Idempotency-Key": `authz-${randomUUID()}` });

let owner: Member;
let follower: Member;
let stranger: Member;
const ids: Record<string, string> = {};

test.before(async () => {
  [owner, follower, stranger] = [await member("owner"), await member("follower"), await member("stranger")];

  assertOk(await call("PATCH", "/api/user/privacy", { token: owner.token, body: { publicProfile: false } }), "owner goes private");
  assertOk(await call("POST", "/api/user/follow-requests", { token: follower.token, body: { targetId: owner.id, id: owner.id } }), "follow request");
  assertOk(await call("POST", `/api/user/follow-requests/${follower.id}/accept`, { token: owner.token }), "owner accepts");

  for (const visibility of ["public", "followers", "private"] as const) {
    const post = await call("POST", "/api/post/add", { token: owner.token, headers: operation(), body: { content: `${visibility} post`, visibility } });
    assertOk(post, `create ${visibility} post`);
    ids[`${visibility}Post`] = (post.body.post as { id: string }).id;
  }
  const story = await call("POST", "/api/story/create", { token: owner.token, headers: operation(), body: { content: "text story", media_type: "text", background_color: "#7A4DF5", overlays: [] } });
  assertOk(story, "create story");
  ids.story = (story.body.story as { id: string }).id;

  const [muscles, equipment] = await Promise.all([call("GET", "/api/muscle-groups", { token: owner.token }), call("GET", "/api/equipment", { token: owner.token })]);
  const firstName = (reply: Reply): string => {
    const list = (Object.values(reply.body).find(Array.isArray) ?? []) as Array<{ name?: string }>;
    return String(list[0]?.name ?? "");
  };
  const exercise = await call("POST", "/api/exercise", { token: owner.token, body: { name: `Authz press ${run}`, muscleGroup: firstName(muscles), equipment: firstName(equipment) } });
  assertOk(exercise, "create custom exercise");
  ids.exercise = String((exercise.body.exercise as { _id?: string; id?: string })._id ?? (exercise.body.exercise as { id?: string }).id);

  const sets = [{ reps: 8, weight: 60, completed: true }];
  const now = Date.now();
  const workout = await call("POST", "/api/workout", { token: owner.token, headers: operation(), body: { name: "Authz workout", startTime: new Date(now - 3_600_000).toISOString(), endTime: new Date(now).toISOString(), exercises: [{ exerciseId: ids.exercise, sets }] } });
  assertOk(workout, "log workout");
  ids.workout = String(((workout.body.workout ?? workout.body.data) as { _id?: string; id?: string })._id ?? ((workout.body.workout ?? workout.body.data) as { id?: string }).id);

  const routine = await call("POST", "/api/routine", { token: owner.token, headers: operation(), body: { name: "Authz routine", exercises: [{ exerciseId: ids.exercise, sets }] } });
  assertOk(routine, "create routine");
  ids.routine = String((routine.body.routine as { _id?: string; id?: string })._id ?? (routine.body.routine as { id?: string }).id);

  const measurement = await call("POST", "/api/measurements", { token: owner.token, body: { measuredOn: new Date().toISOString().slice(0, 10), weightKg: 80 } });
  assertOk(measurement, "save measurement");
  ids.measurement = String((measurement.body.measurement as { id: string }).id);

  // A private account accepts messages from mutual follows only.
  assertOk(await call("POST", "/api/user/follow-requests", { token: owner.token, body: { targetId: follower.id, id: follower.id } }), "owner follows the follower back");
  const message = await call("POST", "/api/message/send", { token: follower.token, headers: operation(), body: { to_user_id: owner.id, text: "hello owner" } });
  assertOk(message, "follower messages the owner");
  ids.message = String((message.body.message as { _id?: string; id?: string })._id ?? (message.body.message as { id?: string }).id);
});

test("positive controls: the follower and the owner see what they are allowed to", async () => {
  assertOk(await call("GET", `/api/post/${ids.followersPost}`, { token: follower.token }), "follower reads followers-only post");
  assertOk(await call("GET", `/api/post/${ids.publicPost}`, { token: follower.token }), "follower reads public post of a private account");
  assertOk(await call("GET", `/api/post/${ids.privatePost}`, { token: owner.token }), "owner reads own private post");
  assertDenied(await call("GET", `/api/post/${ids.privatePost}`, { token: follower.token }), "follower reads owner's private post");
});

test("posts: a stranger can neither read nor act on a private account's posts", async () => {
  for (const key of ["publicPost", "followersPost", "privatePost"]) {
    const postId = ids[key];
    assertDenied(await call("GET", `/api/post/${postId}`, { token: stranger.token }), `${key}: read`);
    assertDenied(await call("GET", `/api/post/${postId}/comments`, { token: stranger.token }), `${key}: comments`);
    assertDenied(await call("PUT", `/api/post/${postId}/like`, { token: stranger.token }), `${key}: like`);
    assertDenied(await call("POST", "/api/post/like", { token: stranger.token, body: { postId } }), `${key}: legacy like`);
    assertDenied(await call("POST", "/api/post/comment/add", { token: stranger.token, body: { postId, content: "hi" } }), `${key}: comment`);
    assertDenied(await call("GET", `/api/post/${postId}/share-card`, { token: stranger.token }), `${key}: share card`);
    assertDenied(await call("GET", `/api/post/${postId}/public`), `${key}: anonymous public read`);
    assertDenied(await call("DELETE", `/api/post/${postId}`, { token: stranger.token }), `${key}: delete`);
    assertDenied(await call("DELETE", `/api/post/${postId}`, { token: follower.token }), `${key}: delete by follower`);
  }
  // The posts survived every attempt.
  assertOk(await call("GET", `/api/post/${ids.privatePost}`, { token: owner.token }), "private post still exists");
});

test("share link: a private account's post reaches nobody signed out", async () => {
  // Behind the web server the share address serves the app shell, which then
  // asks /api/post/:id/public for the post; the shell itself must carry no
  // post data, and the data endpoint must refuse.
  const page = await fetch(`${BASE}/post/${ids.publicPost}`);
  const html = await page.text();
  assert.ok(!html.includes("public post") && !html.includes(owner.username), "the share page carries none of the post");
  assertDenied(await call("GET", `/api/post/${ids.publicPost}/public`), "public post data");
});

test("stories: viewing, liking, listing viewers and deleting are refused to a stranger", async () => {
  assertDenied(await call("POST", `/api/story/${ids.story}/view`, { token: stranger.token }), "story view");
  assertDenied(await call("POST", `/api/story/${ids.story}/like`, { token: stranger.token }), "story like");
  assertDenied(await call("GET", `/api/story/${ids.story}/viewers`, { token: stranger.token }), "story viewers");
  assertDenied(await call("GET", `/api/story/${ids.story}/viewers`, { token: follower.token }), "story viewers by follower");
  assertDenied(await call("DELETE", `/api/story/delete/${ids.story}`, { token: stranger.token }), "story delete");
  const rail = await call("GET", "/api/story/get", { token: stranger.token });
  assert.ok(!JSON.stringify(rail.body).includes(ids.story), "the story is not in the stranger's rail");
  assertOk(await call("POST", `/api/story/${ids.story}/view`, { token: follower.token }), "follower views the story");
});

test("fitness records belong to their owner only", async () => {
  assertDenied(await call("GET", `/api/workout/${ids.workout}/share-card`, { token: stranger.token }), "workout share card");
  assertDenied(await call("PUT", `/api/routine/${ids.routine}`, { token: stranger.token, body: { name: "taken over", exercises: [{ exerciseId: ids.exercise, sets: [{ reps: 1, weight: 1 }] }] } }), "routine update");
  assertDenied(await call("DELETE", `/api/routine/${ids.routine}`, { token: stranger.token }), "routine delete");
  assertDenied(await call("DELETE", `/api/measurements/${ids.measurement}`, { token: stranger.token }), "measurement delete");
  assertDenied(await call("GET", `/api/exercise/${ids.exercise}`, { token: stranger.token }), "custom exercise read");
  const strangerRoutines = await call("GET", "/api/routine", { token: stranger.token });
  assert.ok(!JSON.stringify(strangerRoutines.body).includes(ids.routine), "routine list is scoped to the caller");
  const strangerMeasurements = await call("GET", "/api/measurements", { token: stranger.token });
  assert.ok(!JSON.stringify(strangerMeasurements.body).includes(ids.measurement), "measurement list is scoped to the caller");
  assertOk(await call("GET", `/api/exercise/${ids.exercise}`, { token: owner.token }), "owner reads own custom exercise");
});

test("messages: another member's message cannot be deleted or read", async () => {
  assertDenied(await call("POST", "/api/message/send", { token: stranger.token, headers: operation(), body: { to_user_id: owner.id, text: "let me in" } }), "stranger messages a private account");
  assertDenied(await call("DELETE", `/api/message/delete/${ids.message}`, { token: stranger.token }), "message delete by stranger");
  assertDenied(await call("DELETE", `/api/message/delete/${ids.message}`, { token: owner.token }), "message delete by its recipient");
  const thread = await call("POST", "/api/message/get", { token: stranger.token, body: { to_user_id: owner.id } });
  assert.ok(!JSON.stringify(thread.body).includes("hello owner"), "a stranger's thread with the owner holds no one else's messages");
});

test("profile: a private account reveals no posts and no location to a stranger", async () => {
  const profile = await call("POST", "/api/user/profiles", { token: stranger.token, body: { id: owner.id, userId: owner.id } });
  const text = JSON.stringify(profile.body);
  for (const key of ["publicPost", "followersPost", "privatePost"]) assert.ok(!text.includes(ids[key]), `${key} not in the profile`);
  assert.ok(!/"latitude"|"longitude"|"lat"|"lng"/.test(text), "no coordinates in the profile");
  const header = profile.body.profile as { weight?: unknown; height?: unknown; statistics?: unknown } | undefined;
  assert.equal(header?.weight, null, "weight is withheld from a stranger (D-04)");
  assert.equal(header?.height, null, "height is withheld from a stranger (D-04)");
  assert.equal(header?.statistics, null, "training totals are withheld from a stranger (D-04)");
});

test("export: whatever id is sent, a member exports only their own account", async () => {
  const reply = await call("GET", `/api/user/export?userId=${owner.id}&id=${owner.id}`, { token: stranger.token });
  assertOk(reply, "a member exports their own data");
  assert.equal((reply.body.user as { id?: string }).id, stranger.id);
  assert.equal(reply.body.complete, true, "the file ends with its completeness marker");
  const text = JSON.stringify(reply.body);
  for (const key of ["publicPost", "followersPost", "privatePost"]) assert.ok(!text.includes(ids[key]), `${key} not in the stranger's export`);
});

test("mass assignment: server-owned fields cannot be set by the client", async () => {
  await call("POST", "/api/user/update", { token: stranger.token, body: { role: "superadmin", followers_count: 9999, full_name: "Authz stranger" } });
  const me = await call("GET", "/api/auth/me", { token: stranger.token });
  const user = me.body.user as { role?: string; followers_count?: number };
  assert.notEqual(user.role, "superadmin");
  assert.notEqual(user.followers_count, 9999);
  const post = await call("POST", "/api/post/add", { token: stranger.token, headers: operation(), body: { content: "mine", user: owner.id, like_count: 500, author_username: owner.username } });
  assertOk(post, "stranger posts");
  const created = post.body.post as { like_count?: number; user?: { _id?: string; id?: string } | string; author_username?: string };
  assert.equal(created.like_count ?? 0, 0);
  const authorId = typeof created.user === "string" ? created.user : created.user?._id ?? created.user?.id;
  assert.equal(authorId, stranger.id);
});

test("administration is refused to an ordinary member", async () => {
  assertDenied(await call("GET", "/api/admin/users", { token: stranger.token }), "admin user list");
  assertDenied(await call("PUT", `/api/admin/users/${stranger.id}/role`, { token: stranger.token, body: { role: "superadmin" } }), "self-promotion");
});

test("every protected route refuses a request without a token", async () => {
  for (const [method, path] of [["GET", "/api/post/feed"], ["GET", `/api/post/${ids.publicPost}`], ["GET", "/api/story/get"], ["GET", "/api/notifications"], ["GET", "/api/user/export"], ["GET", "/api/workout"], ["GET", "/api/measurements"], ["GET", "/api/message/conversations"], ["GET", "/api/nearby/users"]] as const) {
    assert.equal((await call(method, path)).status, 401, `${method} ${path}`);
  }
});
