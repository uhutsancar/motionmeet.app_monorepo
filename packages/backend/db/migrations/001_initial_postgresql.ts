import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS citext;

    CREATE TYPE user_role AS ENUM ('user', 'admin', 'superadmin');
    CREATE TYPE plan_status AS ENUM ('free', 'active', 'trialing', 'cancelled', 'expired');
    CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');
    CREATE TYPE set_type AS ENUM ('normal', 'warmup', 'drop', 'failure');
    CREATE TYPE post_type AS ENUM ('text', 'image', 'text_with_image', 'video', 'workout');
    CREATE TYPE post_visibility AS ENUM ('public', 'followers', 'private');
    CREATE TYPE media_type AS ENUM ('image', 'video');
    CREATE TYPE story_media_type AS ENUM ('text', 'image', 'video');
    CREATE TYPE connection_status AS ENUM ('pending', 'accepted');
    CREATE TYPE message_type AS ENUM ('text', 'image');
    CREATE TYPE upload_purpose AS ENUM ('profiles', 'covers', 'posts', 'stories', 'messages');
    CREATE TYPE outbox_status AS ENUM ('pending', 'processing');
    CREATE TYPE outbox_type AS ENUM ('user.profile.updated', 'connection.requested');

    CREATE TABLE plans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE,
      name citext NOT NULL UNIQUE, slug citext NOT NULL UNIQUE, description text NOT NULL DEFAULT '',
      display_order integer NOT NULL DEFAULT 0, trial_days integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
      price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0), currency varchar(8) NOT NULL DEFAULT 'TRY',
      max_workouts_per_month integer NOT NULL DEFAULT 5 CHECK (max_workouts_per_month >= -1),
      max_routines integer NOT NULL DEFAULT 2 CHECK (max_routines >= -1),
      max_posts_per_day integer NOT NULL DEFAULT -1 CHECK (max_posts_per_day >= -1),
      max_stories_per_day integer NOT NULL DEFAULT -1 CHECK (max_stories_per_day >= -1),
      max_media_upload_mb integer NOT NULL DEFAULT 20 CHECK (max_media_upload_mb >= 0),
      can_message_anyone boolean NOT NULL DEFAULT false, premium_content_access boolean NOT NULL DEFAULT false,
      ad_free boolean NOT NULL DEFAULT false, priority_support boolean NOT NULL DEFAULT false,
      can_access_analytics boolean NOT NULL DEFAULT false, can_create_custom_exercises boolean NOT NULL DEFAULT true,
      is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX plans_active_order_idx ON plans (is_active, display_order);
    CREATE TABLE plan_billing_cycles (
      plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      interval billing_interval NOT NULL, price numeric(12,2) NOT NULL CHECK (price >= 0),
      currency varchar(8) NOT NULL DEFAULT 'TRY', stripe_price_id varchar(255) NOT NULL DEFAULT '',
      PRIMARY KEY (plan_id, interval)
    );

    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE,
      email citext NOT NULL UNIQUE CHECK (length(email::text) <= 254),
      full_name varchar(100) NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 100),
      username citext NOT NULL UNIQUE CHECK (username::text ~ '^[a-z0-9._-]{3,30}$'), password_hash text NOT NULL,
      bio varchar(500) NOT NULL DEFAULT 'Athlete on MotionMeet', profile_picture_url varchar(2048) NOT NULL DEFAULT '',
      profile_picture_key varchar(1024) NOT NULL DEFAULT '', cover_photo_url varchar(2048) NOT NULL DEFAULT '',
      cover_photo_key varchar(1024) NOT NULL DEFAULT '', location varchar(100) NOT NULL DEFAULT '', role user_role NOT NULL DEFAULT 'user',
      plan_id uuid REFERENCES plans(id) ON DELETE SET NULL, plan_status plan_status NOT NULL DEFAULT 'free',
      plan_start_date timestamptz, plan_end_date timestamptz, plan_cancelled_at timestamptz,
      stripe_customer_id varchar(255) NOT NULL DEFAULT '', stripe_subscription_id varchar(255) NOT NULL DEFAULT '',
      weight numeric(8,2) NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 1000),
      height numeric(8,2) NOT NULL DEFAULT 0 CHECK (height BETWEEN 0 AND 300),
      followers_count integer NOT NULL DEFAULT 0 CHECK (followers_count >= 0), following_count integer NOT NULL DEFAULT 0 CHECK (following_count >= 0),
      connections_count integer NOT NULL DEFAULT 0 CHECK (connections_count >= 0), privacy_public_profile boolean NOT NULL DEFAULT true,
      privacy_show_workouts_on_feed boolean NOT NULL DEFAULT true, privacy_allow_followers boolean NOT NULL DEFAULT true,
      privacy_show_in_search boolean NOT NULL DEFAULT true, privacy_allow_messages boolean NOT NULL DEFAULT true,
      total_workouts integer NOT NULL DEFAULT 0 CHECK (total_workouts >= 0), total_duration_minutes integer NOT NULL DEFAULT 0 CHECK (total_duration_minutes >= 0),
      total_volume_kg numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_volume_kg >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX users_search_idx ON users USING gin (to_tsvector('simple', username::text || ' ' || full_name));
    CREATE INDEX users_plan_status_idx ON users (plan_status, plan_end_date);
    CREATE INDEX users_created_cursor_idx ON users (created_at DESC, id DESC);

    CREATE TABLE equipment (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, code citext NOT NULL UNIQUE, name varchar(120) NOT NULL, is_active boolean NOT NULL DEFAULT true, display_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX equipment_active_order_idx ON equipment (is_active, display_order);
    CREATE TABLE muscle_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, code citext NOT NULL UNIQUE, name varchar(120) NOT NULL, is_active boolean NOT NULL DEFAULT true, display_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX muscle_groups_active_order_idx ON muscle_groups (is_active, display_order);

    CREATE TABLE exercises (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, external_id varchar(128) UNIQUE,
      name varchar(200) NOT NULL, name_normalized varchar(200) NOT NULL, muscle_group varchar(120) NOT NULL,
      target varchar(120) NOT NULL DEFAULT '', category varchar(120) NOT NULL DEFAULT '', equipment varchar(120) NOT NULL,
      image_url varchar(2048) NOT NULL DEFAULT '', image_key varchar(1024) NOT NULL DEFAULT '', gif_url varchar(2048) NOT NULL DEFAULT '', gif_key varchar(1024) NOT NULL DEFAULT '',
      is_custom boolean NOT NULL DEFAULT false, created_by uuid REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK ((is_custom = false) OR created_by IS NOT NULL)
    );
    CREATE INDEX exercises_name_cursor_idx ON exercises (name_normalized, id);
    CREATE INDEX exercises_filters_idx ON exercises (is_custom, muscle_group, equipment, name_normalized, id);
    CREATE INDEX exercises_created_by_idx ON exercises (created_by, name_normalized, id);
    CREATE INDEX exercises_category_idx ON exercises (category);
    CREATE TABLE exercise_secondary_muscles (exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE, muscle varchar(120) NOT NULL, position smallint NOT NULL CHECK (position >= 0), PRIMARY KEY (exercise_id, position), UNIQUE (exercise_id, muscle));
    CREATE TABLE exercise_instructions (exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE, language varchar(16) NOT NULL, summary text NOT NULL DEFAULT '', steps text[] NOT NULL DEFAULT '{}', PRIMARY KEY (exercise_id, language));

    CREATE TABLE routines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, operation_id varchar(128), name varchar(120) NOT NULL, folder varchar(120) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE NULLS NOT DISTINCT (user_id, operation_id));
    CREATE INDEX routines_user_cursor_idx ON routines (user_id, updated_at DESC, id DESC);
    CREATE TABLE routine_exercises (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64), routine_id uuid NOT NULL REFERENCES routines(id) ON DELETE CASCADE, exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT, position smallint NOT NULL CHECK (position BETWEEN 0 AND 49), exercise_name varchar(200) NOT NULL DEFAULT '', muscle_group varchar(120) NOT NULL DEFAULT '', equipment varchar(120) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (routine_id, position));
    CREATE INDEX routine_exercises_exercise_idx ON routine_exercises (exercise_id);
    CREATE TABLE routine_sets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64), routine_exercise_id uuid NOT NULL REFERENCES routine_exercises(id) ON DELETE CASCADE, position smallint NOT NULL CHECK (position BETWEEN 0 AND 29), set_type set_type NOT NULL DEFAULT 'normal', reps integer NOT NULL DEFAULT 0 CHECK (reps BETWEEN 0 AND 100000), weight numeric(12,2) NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 100000), completed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (routine_exercise_id, position));

    CREATE TABLE workouts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, operation_id varchar(128), name varchar(120) NOT NULL, start_time timestamptz NOT NULL, end_time timestamptz, duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes BETWEEN 0 AND 10080), volume_kg numeric(18,2) NOT NULL DEFAULT 0 CHECK (volume_kg >= 0), total_sets integer NOT NULL DEFAULT 0 CHECK (total_sets BETWEEN 0 AND 1500), total_reps numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_reps >= 0), metrics_version integer NOT NULL DEFAULT 2, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE NULLS NOT DISTINCT (user_id, operation_id), CHECK (end_time IS NULL OR end_time >= start_time));
    CREATE INDEX workouts_user_cursor_idx ON workouts (user_id, start_time DESC, id DESC);
    CREATE INDEX workouts_user_created_idx ON workouts (user_id, created_at DESC);
    CREATE TABLE workout_exercises (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64), workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE, exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT, position smallint NOT NULL CHECK (position BETWEEN 0 AND 49), exercise_name varchar(200) NOT NULL DEFAULT '', muscle_group varchar(120) NOT NULL DEFAULT '', equipment varchar(120) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (workout_id, position));
    CREATE INDEX workout_exercises_exercise_idx ON workout_exercises (exercise_id, workout_id);
    CREATE TABLE workout_sets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64), workout_exercise_id uuid NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE, position smallint NOT NULL CHECK (position BETWEEN 0 AND 29), set_type set_type NOT NULL DEFAULT 'normal', reps integer NOT NULL DEFAULT 0 CHECK (reps BETWEEN 0 AND 100000), weight numeric(12,2) NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 100000), completed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (workout_exercise_id, position));

    CREATE TABLE posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, operation_id varchar(128), author_full_name varchar(100) NOT NULL DEFAULT '', author_username varchar(30) NOT NULL DEFAULT '', author_profile_picture varchar(2048) NOT NULL DEFAULT '', content varchar(5000) NOT NULL DEFAULT '', post_type post_type NOT NULL DEFAULT 'text', visibility post_visibility NOT NULL DEFAULT 'public', like_count integer NOT NULL DEFAULT 0 CHECK (like_count >= 0), comment_count integer NOT NULL DEFAULT 0 CHECK (comment_count >= 0), share_count integer NOT NULL DEFAULT 0 CHECK (share_count >= 0), download_count integer NOT NULL DEFAULT 0 CHECK (download_count >= 0), workout_id uuid REFERENCES workouts(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE NULLS NOT DISTINCT (user_id, operation_id));
    CREATE INDEX posts_feed_idx ON posts (visibility, created_at DESC, id DESC);
    CREATE INDEX posts_user_cursor_idx ON posts (user_id, visibility, created_at DESC, id DESC);
    CREATE TABLE post_media (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64), post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE, position smallint NOT NULL CHECK (position BETWEEN 0 AND 3), url varchar(2048) NOT NULL, object_key varchar(1024) NOT NULL DEFAULT '', media_type media_type NOT NULL DEFAULT 'image', mime_type varchar(200) NOT NULL DEFAULT '', file_size bigint CHECK (file_size IS NULL OR file_size >= 0), width integer CHECK (width IS NULL OR width > 0), height integer CHECK (height IS NULL OR height > 0), duration_seconds numeric(12,3) CHECK (duration_seconds IS NULL OR duration_seconds >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (post_id, position));
    CREATE TABLE post_likes (post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (post_id, user_id));
    CREATE INDEX post_likes_user_idx ON post_likes (user_id, created_at DESC);
    CREATE TABLE post_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, content varchar(1000) NOT NULL CHECK (length(btrim(content)) > 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX post_comments_post_cursor_idx ON post_comments (post_id, created_at DESC, id DESC);
    CREATE INDEX post_comments_user_idx ON post_comments (user_id, created_at DESC);

    CREATE TABLE stories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, operation_id varchar(128), content varchar(2000) NOT NULL DEFAULT '', media_url varchar(2048) NOT NULL DEFAULT '', media_key varchar(1024) NOT NULL DEFAULT '', media_type story_media_type NOT NULL, background_color varchar(32) NOT NULL DEFAULT '', expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE NULLS NOT DISTINCT (user_id, operation_id));
    CREATE INDEX stories_user_active_idx ON stories (user_id, expires_at, created_at DESC, id DESC);
    CREATE INDEX stories_expiry_idx ON stories (expires_at, id);
    CREATE TABLE story_views (story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (story_id, user_id));
    CREATE INDEX story_views_user_idx ON story_views (user_id, created_at DESC);

    CREATE TABLE user_follows (follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, followee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (follower_id, followee_id), CHECK (follower_id <> followee_id));
    CREATE INDEX user_follows_followee_idx ON user_follows (followee_id, created_at DESC, follower_id);
    CREATE INDEX user_follows_follower_idx ON user_follows (follower_id, created_at DESC, followee_id);
    CREATE TABLE connections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, pair_key varchar(73) NOT NULL UNIQUE, status connection_status NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK (from_user_id <> to_user_id));
    CREATE INDEX connections_sender_idx ON connections (from_user_id, status, created_at DESC, id DESC);
    CREATE INDEX connections_recipient_idx ON connections (to_user_id, status, created_at DESC, id DESC);

    CREATE TABLE conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, pair_key varchar(73) NOT NULL UNIQUE, last_message_id uuid, last_message_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE conversation_participants (conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0), joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (conversation_id, user_id));
    CREATE INDEX conversation_participants_user_idx ON conversation_participants (user_id, conversation_id);
    CREATE TABLE messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, operation_id varchar(128), from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, text varchar(2000) NOT NULL DEFAULT '', message_type message_type NOT NULL, media_url varchar(2048) NOT NULL DEFAULT '', media_key varchar(1024) NOT NULL DEFAULT '', seen boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE NULLS NOT DISTINCT (from_user_id, operation_id), CHECK (from_user_id <> to_user_id), CHECK ((message_type = 'text' AND length(btrim(text)) > 0) OR (message_type = 'image' AND media_url <> '')));
    ALTER TABLE conversations ADD CONSTRAINT conversations_last_message_fk FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
    CREATE INDEX messages_conversation_cursor_idx ON messages (conversation_id, created_at DESC, id DESC);
    CREATE INDEX messages_recipient_idx ON messages (to_user_id, created_at DESC, id DESC);

    CREATE TABLE sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash char(64) NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, last_used_at timestamptz NOT NULL DEFAULT now(), user_agent varchar(512) NOT NULL DEFAULT '', ip_address varchar(128) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX sessions_active_user_idx ON sessions (user_id, revoked_at, expires_at);
    CREATE INDEX sessions_expiry_idx ON sessions (expires_at);
    CREATE TABLE password_reset_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash char(64) NOT NULL UNIQUE, expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX password_reset_active_user_idx ON password_reset_tokens (user_id, consumed_at, expires_at);
    CREATE INDEX password_reset_expiry_idx ON password_reset_tokens (expires_at);

    CREATE TABLE upload_reservations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, object_key varchar(1024) NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose upload_purpose NOT NULL, content_type varchar(200) NOT NULL, max_bytes bigint NOT NULL CHECK (max_bytes BETWEEN 1 AND 104857600), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX upload_reservations_user_idx ON upload_reservations (user_id, purpose, created_at DESC);
    CREATE INDEX upload_reservations_expiry_idx ON upload_reservations (expires_at);
    CREATE TABLE media_deletion_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, object_key varchar(1024) NOT NULL UNIQUE, attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0), next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error varchar(500) NOT NULL DEFAULT '', claim_token uuid, claim_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX media_deletion_claim_idx ON media_deletion_jobs (next_attempt_at, claim_until, id);
    CREATE TABLE usage_counters (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, bucket varchar(64) NOT NULL, count integer NOT NULL DEFAULT 0 CHECK (count >= 0), expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, bucket));
    CREATE INDEX usage_expiry_idx ON usage_counters (expires_at) WHERE expires_at IS NOT NULL;
    CREATE TABLE outbox_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, type outbox_type NOT NULL, aggregate_id varchar(128) NOT NULL, payload jsonb NOT NULL, status outbox_status NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0), next_attempt_at timestamptz NOT NULL DEFAULT now(), claim_token uuid, claim_until timestamptz, last_error varchar(500) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX outbox_claim_idx ON outbox_events (status, next_attempt_at, claim_until);
    CREATE INDEX outbox_aggregate_idx ON outbox_events (aggregate_id, created_at DESC);

    CREATE TABLE personal_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE, exercise_name varchar(200) NOT NULL, value numeric(12,2) NOT NULL CHECK (value >= 0), reps integer NOT NULL CHECK (reps >= 0), recorded_at timestamptz NOT NULL, workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, exercise_id));
    CREATE INDEX personal_records_rank_idx ON personal_records (user_id, value DESC, recorded_at DESC, id DESC);
    CREATE TABLE user_daily_workout_stats (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, date_key char(10) NOT NULL, date date NOT NULL, total_workouts integer NOT NULL DEFAULT 0 CHECK (total_workouts >= 0), total_duration_minutes integer NOT NULL DEFAULT 0 CHECK (total_duration_minutes >= 0), total_volume_kg numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_volume_kg >= 0), total_sets integer NOT NULL DEFAULT 0 CHECK (total_sets >= 0), total_reps numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_reps >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, date_key));
    CREATE INDEX daily_workout_user_date_idx ON user_daily_workout_stats (user_id, date DESC, id DESC);
    CREATE TABLE user_daily_muscle_stats (daily_stat_id uuid NOT NULL REFERENCES user_daily_workout_stats(id) ON DELETE CASCADE, muscle varchar(120) NOT NULL, set_count integer NOT NULL DEFAULT 0 CHECK (set_count >= 0), PRIMARY KEY (daily_stat_id, muscle));
    CREATE TABLE user_exercise_daily_stats (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_mongo_id varchar(64) UNIQUE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, date_key char(10) NOT NULL, date date NOT NULL, exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE, exercise_name varchar(200) NOT NULL, muscle_group varchar(120) NOT NULL DEFAULT '', total_volume_kg numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_volume_kg >= 0), total_reps numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_reps >= 0), total_sets integer NOT NULL DEFAULT 0 CHECK (total_sets >= 0), total_sessions integer NOT NULL DEFAULT 0 CHECK (total_sessions >= 0), max_weight numeric(12,2) NOT NULL DEFAULT 0 CHECK (max_weight >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, date_key, exercise_id));
    CREATE INDEX exercise_daily_history_idx ON user_exercise_daily_stats (user_id, exercise_id, date DESC, id DESC);

    CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
    DO $$ DECLARE table_name text; BEGIN FOREACH table_name IN ARRAY ARRAY['plans','users','equipment','muscle_groups','exercises','routines','routine_exercises','routine_sets','workouts','workout_exercises','workout_sets','posts','post_media','post_comments','stories','connections','conversations','messages','sessions','password_reset_tokens','upload_reservations','media_deletion_jobs','usage_counters','outbox_events','personal_records','user_daily_workout_stats','user_exercise_daily_stats'] LOOP EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', table_name, table_name); END LOOP; END $$;
  `).execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
    DROP TABLE IF EXISTS user_daily_muscle_stats, user_exercise_daily_stats, user_daily_workout_stats, personal_records, outbox_events, usage_counters, media_deletion_jobs, upload_reservations, password_reset_tokens, sessions, messages, conversation_participants, conversations, connections, user_follows, story_views, stories, post_comments, post_likes, post_media, posts, workout_sets, workout_exercises, workouts, routine_sets, routine_exercises, routines, exercise_instructions, exercise_secondary_muscles, exercises, muscle_groups, equipment, users, plan_billing_cycles, plans CASCADE;
    DROP TYPE IF EXISTS outbox_type, outbox_status, upload_purpose, message_type, connection_status, story_media_type, media_type, post_visibility, post_type, set_type, billing_interval, plan_status, user_role CASCADE;
  `).execute(db);
};
