import type { StoryOverlay } from "@motionmeet/shared";
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

export type Timestamp = ColumnType<Date, Date | string, Date | string>;
export type GeneratedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;
export type NullableTimestamp = ColumnType<Date | null, Date | string | null, Date | string | null>;
export type Numeric = ColumnType<number, number | string, number | string>;
export type GeneratedNumeric = ColumnType<number, number | string | undefined, number | string>;
export type NullableNumeric = ColumnType<number | null, number | string | null | undefined, number | string | null>;

interface BaseTable {
  id: Generated<string>;
  legacy_mongo_id: string | null;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface UserTable extends BaseTable {
  email: string;
  full_name: string;
  username: string;
  password_hash: string;
  bio: Generated<string>;
  profile_picture_url: Generated<string>;
  profile_picture_key: Generated<string>;
  cover_photo_url: Generated<string>;
  cover_photo_key: Generated<string>;
  /** Rendered label such as `Nilüfer, Bursa, Türkiye`; written by the backend. */
  location: Generated<string>;
  location_country_id: number | null;
  location_state_id: number | null;
  location_city_id: number | null;
  location_source: Generated<string>;
  location_visibility: Generated<"public" | "followers" | "connections" | "private">;
  location_selected_at: NullableTimestamp;
  role: Generated<"user" | "admin" | "superadmin">;
  weight: GeneratedNumeric;
  height: GeneratedNumeric;
  followers_count: Generated<number>;
  following_count: Generated<number>;
  connections_count: Generated<number>;
  privacy_public_profile: Generated<boolean>;
  privacy_show_workouts_on_feed: Generated<boolean>;
  privacy_allow_followers: Generated<boolean>;
  privacy_show_in_search: Generated<boolean>;
  privacy_allow_messages: Generated<boolean>;
  total_workouts: Generated<number>;
  total_duration_minutes: Generated<number>;
  total_volume_kg: GeneratedNumeric;
}

/**
 * Reference tables keep the Countries States Cities dataset's own integer ids
 * so a dataset refresh is an upsert and saved profile locations survive it.
 * `search_name` is the accent-folded key the autocomplete matches against; the
 * importer writes it, queries only read it.
 */
export interface LocationCountryTable {
  id: number;
  name: string;
  name_tr: Generated<string>;
  native_name: Generated<string>;
  iso2: string;
  iso3: string;
  phone_code: Generated<string>;
  emoji: Generated<string>;
  latitude: number | null;
  longitude: number | null;
  search_name: string;
  is_active: Generated<boolean>;
  dataset_version: string;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface LocationStateTable {
  id: number;
  country_id: number;
  name: string;
  state_code: Generated<string>;
  type: Generated<string>;
  latitude: number | null;
  longitude: number | null;
  search_name: string;
  is_active: Generated<boolean>;
  dataset_version: string;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface LocationCityTable {
  id: number;
  country_id: number;
  state_id: number | null;
  name: string;
  latitude: number;
  longitude: number;
  population: Generated<number>;
  search_name: string;
  is_active: Generated<boolean>;
  dataset_version: string;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

/**
 * The device GPS fix. Deliberately separate from `users` so that clearing it,
 * or opting out of nearby, cannot disturb the profile. No column here is ever
 * serialised to a client.
 */
export interface UserLocationTable {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: NullableNumeric;
  source: Generated<"gps" | "network" | "coarse">;
  city_id: number | null;
  enabled: Generated<boolean>;
  visible: Generated<boolean>;
  distance_visibility: Generated<"approximate" | "nearby_only" | "hidden">;
  scope: Generated<"5km" | "10km" | "25km" | "50km" | "city">;
  permission_status: Generated<string>;
  location_updated_at: GeneratedTimestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface LookupTable extends BaseTable {
  code: string;
  name: string;
  is_active: Generated<boolean>;
  display_order: Generated<number>;
}

export interface ExerciseTable extends BaseTable {
  external_id: string | null;
  name: string;
  name_normalized: string;
  muscle_group: string;
  target: Generated<string>;
  category: Generated<string>;
  equipment: string;
  image_url: Generated<string>;
  image_key: Generated<string>;
  gif_url: Generated<string>;
  gif_key: Generated<string>;
  is_custom: Generated<boolean>;
  created_by: string | null;
}

export interface ExerciseSecondaryMuscleTable {
  exercise_id: string;
  muscle: string;
  position: number;
}

export interface ExerciseInstructionTable {
  exercise_id: string;
  language: string;
  summary: Generated<string>;
  steps: Generated<string[]>;
}

export interface RoutineTable extends BaseTable {
  user_id: string;
  operation_id: string | null;
  name: string;
  folder: Generated<string>;
}

export interface RoutineExerciseTable extends BaseTable {
  routine_id: string;
  exercise_id: string | null;
  position: number;
  exercise_name: Generated<string>;
  muscle_group: Generated<string>;
  equipment: Generated<string>;
}

export interface RoutineSetTable extends BaseTable {
  routine_exercise_id: string;
  position: number;
  set_type: Generated<"normal" | "warmup" | "drop" | "failure">;
  reps: Generated<number>;
  weight: GeneratedNumeric;
  completed: Generated<boolean>;
}

export interface WorkoutTable extends BaseTable {
  user_id: string;
  operation_id: string | null;
  name: string;
  start_time: Timestamp;
  end_time: NullableTimestamp;
  duration_minutes: Generated<number>;
  volume_kg: GeneratedNumeric;
  total_sets: Generated<number>;
  total_reps: GeneratedNumeric;
  metrics_version: Generated<number>;
}

export interface WorkoutExerciseTable extends BaseTable {
  workout_id: string;
  exercise_id: string | null;
  position: number;
  exercise_name: Generated<string>;
  muscle_group: Generated<string>;
  equipment: Generated<string>;
}

export interface WorkoutSetTable extends BaseTable {
  workout_exercise_id: string;
  position: number;
  set_type: Generated<"normal" | "warmup" | "drop" | "failure">;
  reps: Generated<number>;
  weight: GeneratedNumeric;
  completed: Generated<boolean>;
}

export interface PostTable extends BaseTable {
  user_id: string;
  operation_id: string | null;
  author_full_name: Generated<string>;
  author_username: Generated<string>;
  author_profile_picture: Generated<string>;
  content: Generated<string>;
  post_type: Generated<"text" | "image" | "text_with_image" | "video" | "workout">;
  visibility: Generated<"public" | "followers" | "private">;
  like_count: Generated<number>;
  comment_count: Generated<number>;
  share_count: Generated<number>;
  download_count: Generated<number>;
  workout_id: string | null;
  /**
   * Keşfet ordering key: engagement converted into a bonus measured in days of
   * freshness. Generated by PostgreSQL, so it is read-only here.
   */
  discover_rank: ColumnType<number, never, never>;
}

export interface PostMediaTable extends BaseTable {
  post_id: string;
  position: number;
  url: string;
  object_key: Generated<string>;
  media_type: Generated<"image" | "video">;
  mime_type: Generated<string>;
  file_size: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: Numeric | null;
}

export interface PostLikeTable {
  post_id: string;
  user_id: string;
  created_at: GeneratedTimestamp;
}

export interface PostCommentTable extends BaseTable {
  post_id: string;
  user_id: string;
  content: string;
}

export interface StoryTable extends BaseTable {
  user_id: string;
  operation_id: string | null;
  content: Generated<string>;
  media_url: Generated<string>;
  media_key: Generated<string>;
  media_type: "text" | "image" | "video";
  background_color: Generated<string>;
  overlays: Generated<StoryOverlay[]>;
  expires_at: Timestamp;
}

export interface BodyMeasurementTable {
  id: Generated<string>;
  user_id: string;
  measured_on: string;
  weight_kg: NullableNumeric;
  body_fat_percentage: NullableNumeric;
  waist_cm: NullableNumeric;
  chest_cm: NullableNumeric;
  hips_cm: NullableNumeric;
  neck_cm: NullableNumeric;
  shoulders_cm: NullableNumeric;
  left_arm_cm: NullableNumeric;
  right_arm_cm: NullableNumeric;
  left_thigh_cm: NullableNumeric;
  right_thigh_cm: NullableNumeric;
  note: Generated<string>;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface StoryViewTable {
  story_id: string;
  user_id: string;
  created_at: GeneratedTimestamp;
}

/** One row per (story, member). Its presence *is* the like. */
export interface StoryLikeTable {
  story_id: string;
  user_id: string;
  created_at: GeneratedTimestamp;
}

export interface UserFollowTable {
  follower_id: string;
  followee_id: string;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

/**
 * Pending follow requests only. Accepting one writes the edge into
 * `user_follows` and deletes the row, so `user_follows` remains the single
 * answer to "does A follow B".
 */
export interface FollowRequestTable {
  id: Generated<string>;
  requester_id: string;
  target_id: string;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export type NotificationType =
  | "follow_request"
  | "follow_request_accepted"
  | "follow"
  | "post_like"
  | "post_comment"
  | "story_like";

export interface NotificationTable {
  id: Generated<string>;
  /** Recipient. */
  user_id: string;
  /** Who caused it. */
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  /** Set on story_like; the row is cascaded away when the story expires. */
  story_id: string | null;
  read_at: NullableTimestamp;
  created_at: GeneratedTimestamp;
  updated_at: GeneratedTimestamp;
}

export interface ConnectionTable extends BaseTable {
  from_user_id: string;
  to_user_id: string;
  pair_key: string;
  status: Generated<"pending" | "accepted">;
}

export interface ConversationTable extends BaseTable {
  pair_key: string;
  last_message_id: string | null;
  last_message_at: NullableTimestamp;
}

export interface ConversationParticipantTable {
  conversation_id: string;
  user_id: string;
  unread_count: Generated<number>;
  joined_at: GeneratedTimestamp;
}

export interface MessageTable extends BaseTable {
  conversation_id: string;
  operation_id: string | null;
  from_user_id: string;
  to_user_id: string;
  text: Generated<string>;
  message_type: "text" | "image";
  media_url: Generated<string>;
  media_key: Generated<string>;
  seen: Generated<boolean>;
}

export interface SessionTable extends BaseTable {
  user_id: string;
  token_hash: string;
  expires_at: Timestamp;
  revoked_at: NullableTimestamp;
  last_used_at: GeneratedTimestamp;
  user_agent: Generated<string>;
  ip_address: Generated<string>;
}

export interface PasswordResetTokenTable extends BaseTable {
  user_id: string;
  token_hash: string;
  expires_at: Timestamp;
  consumed_at: NullableTimestamp;
}

export interface UploadReservationTable extends BaseTable {
  object_key: string;
  user_id: string;
  purpose: "profiles" | "covers" | "posts" | "stories" | "messages";
  content_type: string;
  max_bytes: number;
  expires_at: Timestamp;
}

export interface MediaDeletionJobTable extends BaseTable {
  object_key: string;
  attempts: Generated<number>;
  next_attempt_at: GeneratedTimestamp;
  last_error: Generated<string>;
  claim_token: string | null;
  claim_until: NullableTimestamp;
}

export interface UsageCounterTable extends BaseTable {
  user_id: string;
  bucket: string;
  count: Generated<number>;
  expires_at: NullableTimestamp;
}

export type OutboxPayload = Record<string, string | number | boolean | null>;

export interface OutboxEventTable extends BaseTable {
  type: "user.profile.updated" | "connection.requested";
  aggregate_id: string;
  payload: OutboxPayload;
  status: Generated<"pending" | "processing">;
  attempts: Generated<number>;
  next_attempt_at: GeneratedTimestamp;
  claim_token: string | null;
  claim_until: NullableTimestamp;
  last_error: Generated<string>;
}

export interface PersonalRecordTable extends BaseTable {
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  value: Numeric;
  reps: number;
  recorded_at: Timestamp;
  workout_id: string;
}

export interface UserDailyWorkoutStatTable extends BaseTable {
  user_id: string;
  date_key: string;
  date: Timestamp;
  total_workouts: Generated<number>;
  total_duration_minutes: Generated<number>;
  total_volume_kg: GeneratedNumeric;
  total_sets: Generated<number>;
  total_reps: GeneratedNumeric;
}

export interface UserDailyMuscleStatTable {
  daily_stat_id: string;
  muscle: string;
  set_count: Generated<number>;
}

export interface UserExerciseDailyStatTable extends BaseTable {
  user_id: string;
  date_key: string;
  date: Timestamp;
  exercise_id: string;
  exercise_name: string;
  muscle_group: Generated<string>;
  total_volume_kg: GeneratedNumeric;
  total_reps: GeneratedNumeric;
  total_sets: Generated<number>;
  total_sessions: Generated<number>;
  max_weight: GeneratedNumeric;
}

export interface Database {
  users: UserTable;
  location_countries: LocationCountryTable;
  location_states: LocationStateTable;
  location_cities: LocationCityTable;
  user_locations: UserLocationTable;
  equipment: LookupTable;
  muscle_groups: LookupTable;
  exercises: ExerciseTable;
  exercise_secondary_muscles: ExerciseSecondaryMuscleTable;
  exercise_instructions: ExerciseInstructionTable;
  routines: RoutineTable;
  routine_exercises: RoutineExerciseTable;
  routine_sets: RoutineSetTable;
  workouts: WorkoutTable;
  workout_exercises: WorkoutExerciseTable;
  workout_sets: WorkoutSetTable;
  posts: PostTable;
  post_media: PostMediaTable;
  post_likes: PostLikeTable;
  post_comments: PostCommentTable;
  stories: StoryTable;
  story_views: StoryViewTable;
  story_likes: StoryLikeTable;
  body_measurements: BodyMeasurementTable;
  user_follows: UserFollowTable;
  follow_requests: FollowRequestTable;
  notifications: NotificationTable;
  connections: ConnectionTable;
  conversations: ConversationTable;
  conversation_participants: ConversationParticipantTable;
  messages: MessageTable;
  sessions: SessionTable;
  password_reset_tokens: PasswordResetTokenTable;
  upload_reservations: UploadReservationTable;
  media_deletion_jobs: MediaDeletionJobTable;
  usage_counters: UsageCounterTable;
  outbox_events: OutboxEventTable;
  personal_records: PersonalRecordTable;
  user_daily_workout_stats: UserDailyWorkoutStatTable;
  user_daily_muscle_stats: UserDailyMuscleStatTable;
  user_exercise_daily_stats: UserExerciseDailyStatTable;
}

export type Row<TableName extends keyof Database> = Selectable<Database[TableName]>;
export type NewRow<TableName extends keyof Database> = Insertable<Database[TableName]>;
export type RowUpdate<TableName extends keyof Database> = Updateable<Database[TableName]>;
