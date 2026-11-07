-- Synthetic, production-shaped data for load and query-plan rehearsals.
--
-- NEVER run against a database with real members. It refuses unless the
-- session opts in explicitly:
--
--   docker exec -i -e PGOPTIONS='-c motionmeet.allow_synthetic_seed=yes' \
--     motionmeet_prod-postgres-1 psql -U motionmeet -d motionmeet -v ON_ERROR_STOP=1 \
--     -f - < scripts/load/seed-synthetic.sql
--
-- Shape (default sizes): 20 000 members (10 % private), a skewed follow graph
-- (~40 follows each; a few accounts are followed by thousands), 300 000 posts
-- over 90 days, ~1 000 000 likes, 20 000 accepted connections. Popularity is
-- skewed with power(random(), k) so a handful of accounts dominate, as in a
-- real social graph. Every row hangs off a member whose email ends in
-- @synthetic.test; scripts/load/purge-synthetic.sql removes them all.
--
-- Every synthetic member's password is "synthetic-password-1".

DO $$
BEGIN
  IF current_setting('motionmeet.allow_synthetic_seed', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Refusing to seed synthetic data: set motionmeet.allow_synthetic_seed=yes for this session (disposable databases only)';
  END IF;
END $$;

\set members 20000
\set follows_per_member 40
\set posts 300000
\set likes 1000000

BEGIN;

CREATE TEMP TABLE synthetic_members ON COMMIT DROP AS
WITH inserted AS (
  INSERT INTO users (email, full_name, username, password_hash, privacy_public_profile, privacy_show_workouts_on_feed, created_at)
  SELECT 'member' || n || '@synthetic.test', 'Synthetic Member ' || n, 'synthetic_' || n,
         '$2b$12$kCF62ag6woXDkt8EjwaAouSJyS/chgtFQzm5dBFCNnIPjt5DHzt7S',
         random() > 0.10, random() > 0.15,
         now() - (random() * interval '180 days')
  FROM generate_series(1, :members) AS n
  ON CONFLICT DO NOTHING
  RETURNING id
)
SELECT row_number() OVER () AS n, id FROM inserted;
CREATE INDEX ON synthetic_members (n);
ANALYZE synthetic_members;

-- Skewed follow graph: power(random(), 3) piles followers onto low n. The pick
-- is made in a LATERAL subquery that references the outer row, so random()
-- runs once per follow - in a JOIN condition it would run per candidate row.
INSERT INTO user_follows (follower_id, followee_id, created_at)
SELECT follower.id, followee.id, now() - (random() * interval '120 days')
FROM synthetic_members follower
CROSS JOIN LATERAL (
  SELECT 1 + floor(power(random(), 3) * :members)::int AS pick
  FROM generate_series(1, :follows_per_member)
  WHERE follower.n IS NOT NULL
) AS picks
JOIN synthetic_members followee ON followee.n = picks.pick
WHERE followee.id <> follower.id
ON CONFLICT DO NOTHING;

INSERT INTO connections (from_user_id, to_user_id, pair_key, status, created_at)
SELECT a.id, b.id, least(a.id::text, b.id::text) || ':' || greatest(a.id::text, b.id::text), 'accepted', now() - (random() * interval '120 days')
FROM synthetic_members a
JOIN synthetic_members b ON b.n = 1 + ((a.n * 7919) % :members)
WHERE a.id <> b.id
ON CONFLICT DO NOTHING;

-- Posting activity is skewed too (power 2), spread over 90 days.
INSERT INTO posts (user_id, author_full_name, author_username, content, post_type, visibility, created_at)
SELECT m.id, 'Synthetic Member ' || m.n, 'synthetic_' || m.n, 'synthetic post ' || p,
       (ARRAY['text', 'text_with_image', 'image', 'workout', 'video'])[1 + floor(random() * 5)::int]::post_type,
       (CASE WHEN r < 0.80 THEN 'public' WHEN r < 0.95 THEN 'followers' ELSE 'private' END)::post_visibility,
       now() - (random() * interval '90 days')
FROM generate_series(1, :posts) AS p
CROSS JOIN LATERAL (SELECT random() AS r, 1 + floor(power(random() + p * 0, 2) * :members)::int AS pick) AS chosen
JOIN synthetic_members m ON m.n = chosen.pick;

CREATE TEMP TABLE synthetic_posts ON COMMIT DROP AS
SELECT row_number() OVER () AS n, p.id
FROM posts p JOIN synthetic_members m ON m.id = p.user_id;
CREATE INDEX ON synthetic_posts (n);
ANALYZE synthetic_posts;

INSERT INTO post_likes (post_id, user_id, created_at)
SELECT sp.id, m.id, now() - (random() * interval '60 days')
FROM generate_series(1, :likes) AS l
CROSS JOIN LATERAL (
  SELECT 1 + floor(power(random() + l * 0, 2) * (SELECT count(*) FROM synthetic_posts))::int AS post_pick,
         1 + floor(random() * :members + l * 0)::int AS member_pick
) AS pick
JOIN synthetic_posts sp ON sp.n = pick.post_pick
JOIN synthetic_members m ON m.n = pick.member_pick
ON CONFLICT DO NOTHING;

-- Hot threads (MM-PERF-01): the 30 most-liked posts get 10 000 comments each,
-- so the comment-preview query behind every feed page meets the posts that
-- make it expensive. Commenters are spread over the members.
INSERT INTO post_comments (post_id, user_id, content, created_at)
SELECT hot.id, m.id, 'synthetic comment ' || g, now() - (g || ' seconds')::interval
FROM (SELECT p.id FROM posts p JOIN synthetic_posts sp ON sp.id = p.id
      ORDER BY (SELECT count(*) FROM post_likes pl WHERE pl.post_id = p.id) DESC LIMIT 30) hot
CROSS JOIN generate_series(1, 10000) g
JOIN synthetic_members m ON m.n = 1 + (g % :members);
UPDATE posts p SET comment_count = c.total
FROM (SELECT post_id, count(*)::int AS total FROM post_comments GROUP BY post_id) c, synthetic_posts sp
WHERE p.id = c.post_id AND p.id = sp.id;

-- Denormalised counters, as the application would have maintained them.
UPDATE posts p SET like_count = c.likes
FROM (SELECT post_id, count(*)::int AS likes FROM post_likes GROUP BY post_id) c, synthetic_posts sp
WHERE p.id = c.post_id AND p.id = sp.id;
UPDATE users u SET followers_count = c.total
FROM (SELECT followee_id, count(*)::int AS total FROM user_follows GROUP BY followee_id) c, synthetic_members m
WHERE u.id = c.followee_id AND u.id = m.id;
UPDATE users u SET following_count = c.total
FROM (SELECT follower_id, count(*)::int AS total FROM user_follows GROUP BY follower_id) c, synthetic_members m
WHERE u.id = c.follower_id AND u.id = m.id;

COMMIT;

ANALYZE users;
ANALYZE user_follows;
ANALYZE connections;
ANALYZE posts;
ANALYZE post_likes;
ANALYZE post_comments;

SELECT (SELECT count(*) FROM users WHERE email LIKE '%@synthetic.test') AS members,
       (SELECT count(*) FROM user_follows) AS follows,
       (SELECT count(*) FROM connections) AS connections,
       (SELECT count(*) FROM posts) AS posts,
       (SELECT count(*) FROM post_likes) AS likes,
       (SELECT count(*) FROM post_comments) AS comments;
