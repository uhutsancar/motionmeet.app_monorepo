/**
 * Imported first by every integration test, before `dotenv/config`.
 *
 * These tests insert and delete users, posts and messages. They used to sit in
 * the unit-test glob and pick up DATABASE_URL from `.env`, which on a developer
 * machine is the working database - so a plain `pnpm test` wrote to it. Now the
 * URL has to be set explicitly in the environment, and the database it names
 * has to be a disposable one (`*_test`, as in docker-compose.test.yml).
 */
const configured = process.env.DATABASE_URL?.trim();
let databaseName = "";
try {
  databaseName = configured ? decodeURIComponent(new URL(configured).pathname.replace(/^\//, "")) : "";
} catch {
  databaseName = "";
}

if (!/_test$/.test(databaseName)) {
  throw new Error(
    "Integration tests need DATABASE_URL set in the environment to a database whose name ends in _test " +
    `(found ${configured ? `"${databaseName || "unparseable URL"}"` : "nothing"}). ` +
    "Start one with: docker compose -f docker-compose.test.yml up -d --wait postgres-test",
  );
}

export {};
