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
