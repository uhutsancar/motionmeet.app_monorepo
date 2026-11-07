import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { sql } from "kysely";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { deleteAccountData } from "../../services/accountService.js";

test.before(async () => { await connectDatabase(); });
test.after(async () => { await disconnectDatabase(); });

const runId = randomUUID().slice(0, 8);
const newUser = async (name: string): Promise<string> => (await database.insertInto("users")
  .values({ legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: name, username: `${name}_${runId}`, password_hash: "test-hash" })
  .returning("id").executeTakeFirstOrThrow()).id;

/**
 * More than one purge batch (1 000) of likes in both directions, comments,
 * follows and a connection: the deletion goes in short batches and every
 * counter it leaves on other members ends where it started.
 */
test("deleting a long-lived account settles every other member's counters, across several batches", async () => {
  const leaving = await newUser("leaving");
  const staying = await newUser("staying");
  const fans = await Promise.all(Array.from({ length: 3 }, (_, index) => newUser(`fan${index}`)));
  try {
    // 1 200 posts by `staying`, each liked and commented once by `leaving`.
    await sql`insert into posts (user_id, author_full_name, author_username, content, post_type, visibility, like_count, comment_count)
      select ${staying}, 'staying', 'staying', 'post ' || n, 'text'::post_type, 'public'::post_visibility, 1, 1 from generate_series(1, 1200) as n`.execute(database);
    await sql`insert into post_likes (post_id, user_id) select id, ${leaving} from posts where user_id = ${staying}`.execute(database);
    await sql`insert into post_comments (post_id, user_id, content) select id, ${leaving}, 'nice' from posts where user_id = ${staying}`.execute(database);
    // 1 100 posts by `leaving`, each liked by every fan.
    await sql`insert into posts (user_id, author_full_name, author_username, content, post_type, visibility)
      select ${leaving}, 'leaving', 'leaving', 'mine ' || n, 'text'::post_type, 'public'::post_visibility from generate_series(1, 1100) as n`.execute(database);
    for (const fan of fans) await sql`insert into post_likes (post_id, user_id) select id, ${fan} from posts where user_id = ${leaving}`.execute(database);
    // Follows both ways with the counters the services keep.
    for (const fan of fans) {
      await database.insertInto("user_follows").values([{ follower_id: fan, followee_id: leaving }, { follower_id: leaving, followee_id: fan }]).execute();
    }
    await database.updateTable("users").set({ following_count: 1, followers_count: 1 }).where("id", "in", fans).execute();
    await database.insertInto("connections").values({ legacy_mongo_id: null, from_user_id: leaving, to_user_id: staying, pair_key: [leaving, staying].sort().join(":"), status: "accepted" }).execute();
    await database.updateTable("users").set({ connections_count: 1 }).where("id", "=", staying).execute();
    const workout = await database.insertInto("workouts").values({ legacy_mongo_id: null, user_id: leaving, operation_id: null, name: "Last one", start_time: new Date() }).returning("id").executeTakeFirstOrThrow();

    assert.equal(await deleteAccountData(leaving), true);

    assert.equal(await database.selectFrom("users").select("id").where("id", "=", leaving).executeTakeFirst(), undefined);
    const counters = await database.selectFrom("posts").select([sql<number>`max(like_count)`.as("likes"), sql<number>`max(comment_count)`.as("comments")]).where("user_id", "=", staying).executeTakeFirstOrThrow();
    assert.equal(Number(counters.likes), 0, "every like the member gave is taken off its post");
    assert.equal(Number(counters.comments), 0, "and every comment");
    const fanRows = await database.selectFrom("users").select(["followers_count", "following_count"]).where("id", "in", fans).execute();
    for (const fan of fanRows) assert.deepEqual(fan, { followers_count: 0, following_count: 0 });
    assert.equal((await database.selectFrom("users").select("connections_count").where("id", "=", staying).executeTakeFirstOrThrow()).connections_count, 0);
    const fanLikes = await database.selectFrom("post_likes").select(sql<string>`count(*)`.as("count")).where("user_id", "in", fans).executeTakeFirstOrThrow();
    assert.equal(Number(fanLikes.count), 0, "likes on the member's posts went with them");
    assert.equal(await database.selectFrom("workouts").select("id").where("id", "=", workout.id).executeTakeFirst(), undefined);
  } finally {
    await database.deleteFrom("users").where("id", "in", [leaving, staying, ...fans]).execute();
  }
});
