import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { sql } from "kysely";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { findHydratedPost } from "../../repositories/postRepository.js";
import { hydratePostInteractions } from "../../services/postInteractionService.js";

/**
 * MM-PERF-01 (WP-16 of the 2026-11 audit): the feed's comment previews are
 * read three per post off the post's own index instead of ranking every
 * comment of every post on the page. Same answer as the window-function
 * query it replaced - including ties on `created_at`, broken by id.
 */
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];

/** The query this work package replaced, kept here as the reference. */
const referencePreviews = async (postIds: string[], limit: number): Promise<Map<string, string[]>> => {
  const { rows } = await sql<{ id: string; post_id: string }>`
    select id, post_id from (
      select id, post_id, created_at, row_number() over (partition by post_id order by created_at desc, id desc) as post_rank
      from post_comments where post_id = any(${postIds}::uuid[])
    ) ranked where post_rank <= ${limit}
    order by post_id, created_at asc, id asc`.execute(database);
  const byPost = new Map<string, string[]>();
  for (const row of rows) byPost.set(row.post_id, [...(byPost.get(row.post_id) ?? []), row.id]);
  return byPost;
};

test.before(async () => { await connectDatabase(); });
test.after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await disconnectDatabase();
});

test("previews are the three newest comments per post, exactly as before", async () => {
  const author = await database.insertInto("users").values({ legacy_mongo_id: null, email: `preview-${runId}@example.test`, full_name: "preview member", username: `preview_${runId}`, password_hash: "x" }).returning("id").executeTakeFirstOrThrow();
  userIds.push(author.id);
  const counts = [0, 2, 3, 7, 40];
  const postIds: string[] = [];
  for (const count of counts) {
    const post = await database.insertInto("posts").values({ user_id: author.id, author_full_name: "a", author_username: "a", content: `${count} comments`, post_type: "text", visibility: "public" }).returning("id").executeTakeFirstOrThrow();
    postIds.push(post.id);
    if (count) {
      // Every third comment shares its timestamp with the previous one, so
      // the id tie-break decides.
      await sql`insert into post_comments (post_id, user_id, content, created_at)
        select ${post.id}::uuid, ${author.id}::uuid, 'c' || g, now() - ((g / 3) || ' minutes')::interval from generate_series(1, ${count}) g`.execute(database);
      await database.updateTable("posts").set({ comment_count: count }).where("id", "=", post.id).execute();
    }
  }
  const posts = await Promise.all(postIds.map(async (id) => (await findHydratedPost(id))!));
  const hydrated = await hydratePostInteractions(posts, author.id);
  const reference = await referencePreviews(postIds, 3);
  for (const [index, post] of hydrated.entries()) {
    assert.deepEqual((post.comments ?? []).map((comment) => comment.id), reference.get(post.id) ?? [], `post with ${counts[index]} comments`);
    assert.equal(post.comment_next_cursor !== null, counts[index]! > 3, "more beyond the preview only when there are more");
  }
});
