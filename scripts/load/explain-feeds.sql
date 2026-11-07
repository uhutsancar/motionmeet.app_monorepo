-- Query plans of the two feed queries, as services/postService.ts builds them,
-- for a typical synthetic member (follows ~40 accounts). Read-only.
--
--   docker exec -i motionmeet_prod-postgres-1 psql -U motionmeet -d motionmeet -f - < scripts/load/explain-feeds.sql

SELECT id AS viewer FROM users WHERE username = 'synthetic_10000' \gset

\echo '=== following feed, audience-first (current), first page'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, SUMMARY ON)
WITH audience AS (
  SELECT :'viewer'::uuid AS user_id, true AS is_self, true AS shows_workouts
  UNION ALL
  SELECT u.id, false, u.privacy_show_workouts_on_feed FROM users u
  WHERE u.id <> :'viewer'::uuid AND u.id IN (
    SELECT uf.followee_id FROM user_follows uf WHERE uf.follower_id = :'viewer'::uuid
    UNION
    SELECT CASE WHEN c.from_user_id = :'viewer'::uuid THEN c.to_user_id ELSE c.from_user_id END FROM connections c
    WHERE c.status = 'accepted' AND (c.from_user_id = :'viewer'::uuid OR c.to_user_id = :'viewer'::uuid)))
SELECT page.* FROM audience a
CROSS JOIN LATERAL (
  SELECT p.* FROM posts p WHERE p.user_id = a.user_id
    AND (a.is_self OR p.visibility IN ('public', 'followers'))
    AND (a.is_self OR p.post_type <> 'workout' OR a.shows_workouts)
  ORDER BY p.created_at DESC, p.id DESC LIMIT 31) page
ORDER BY page.created_at DESC, page.id DESC LIMIT 31;

\echo '=== following feed, table scan (before 015), first page'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, SUMMARY ON)
SELECT posts.* FROM posts INNER JOIN users AS author ON author.id = posts.user_id
WHERE (posts.user_id = :'viewer' OR (posts.visibility IN ('public', 'followers')
  AND (EXISTS (SELECT 1 FROM user_follows uf WHERE uf.follower_id = :'viewer' AND uf.followee_id = posts.user_id)
    OR EXISTS (SELECT 1 FROM connections c WHERE c.status = 'accepted' AND ((c.from_user_id = :'viewer' AND c.to_user_id = posts.user_id) OR (c.to_user_id = :'viewer' AND c.from_user_id = posts.user_id))))
  AND (posts.post_type <> 'workout' OR author.privacy_show_workouts_on_feed = true)))
ORDER BY posts.created_at DESC, posts.id DESC LIMIT 31;

\echo '=== discover feed, first page'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, SUMMARY ON)
SELECT posts.* FROM posts INNER JOIN users AS author ON author.id = posts.user_id
WHERE posts.visibility = 'public'
  AND (author.privacy_public_profile = true OR posts.user_id = :'viewer'
    OR EXISTS (SELECT 1 FROM user_follows uf WHERE uf.follower_id = :'viewer' AND uf.followee_id = posts.user_id))
  AND (posts.post_type <> 'workout' OR author.privacy_show_workouts_on_feed = true)
ORDER BY posts.discover_rank DESC, posts.id DESC LIMIT 31;

-- Comment previews for one feed page (MM-PERF-01): the three newest comments
-- of each of 30 posts. The page is the 30 posts with the most comments, which
-- the seed gives 10 000 each.
SELECT array_agg(id) AS hot_posts FROM (SELECT id FROM posts ORDER BY comment_count DESC LIMIT 30) hot \gset

\echo '=== comment previews, row_number() over every comment of the page (before WP-16)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, SUMMARY ON)
SELECT id, post_id, user_id, content, created_at, updated_at FROM (
  SELECT post_comments.*, row_number() OVER (PARTITION BY post_id ORDER BY created_at DESC, id DESC) AS post_rank
  FROM post_comments WHERE post_id = ANY(:'hot_posts'::uuid[])
) ranked_comments WHERE post_rank <= 3;

\echo '=== comment previews, LATERAL three rows per post off post_comments_post_cursor_idx (current)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, SUMMARY ON)
SELECT c.id, c.post_id, c.user_id, c.content, c.created_at, c.updated_at
FROM unnest(:'hot_posts'::uuid[]) AS page(post_id)
CROSS JOIN LATERAL (
  SELECT * FROM post_comments WHERE post_comments.post_id = page.post_id
  ORDER BY created_at DESC, id DESC LIMIT 3
) c;
