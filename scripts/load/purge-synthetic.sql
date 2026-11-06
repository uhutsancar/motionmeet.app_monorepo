-- Removes everything seed-synthetic.sql created: the synthetic members, and
-- with them (ON DELETE CASCADE) their posts, likes, follows and connections.
-- Same opt-in as the seed.
DO $$
BEGIN
  IF current_setting('motionmeet.allow_synthetic_seed', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Refusing to purge: set motionmeet.allow_synthetic_seed=yes for this session';
  END IF;
END $$;

DELETE FROM users WHERE email LIKE '%@synthetic.test';
VACUUM ANALYZE users;
VACUUM ANALYZE posts;
VACUUM ANALYZE post_likes;
VACUUM ANALYZE user_follows;
VACUUM ANALYZE connections;
