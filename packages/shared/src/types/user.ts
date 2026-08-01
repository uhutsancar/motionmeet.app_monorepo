import type { EntityId, Timestamped } from "./common.js";

export type Role = "user" | "admin" | "superadmin";
export type PlanStatus = "free" | "active" | "trialing" | "cancelled" | "expired";

export interface PrivacySettings {
  publicProfile: boolean;
  showWorkoutsOnFeed: boolean;
  allowFollowers: boolean;
  showInSearch: boolean;
  allowMessages: boolean;
}

export interface UserStatistics {
  totalWorkouts: number;
  totalDurationMinutes: number;
  totalVolumeKg: number;
}

export interface PlanFeatures {
  max_workouts_per_month: number;
  max_routines: number;
  max_posts_per_day: number;
  max_stories_per_day: number;
  max_media_upload_mb: number;
  can_message_anyone: boolean;
  premium_content_access: boolean;
  ad_free: boolean;
  priority_support: boolean;
  can_access_analytics: boolean;
  can_create_custom_exercises: boolean;
}

export interface BillingCycle {
  interval: "monthly" | "yearly";
  price: number;
  currency: string;
  stripePriceId: string;
}

export interface Plan extends Timestamped {
  id: EntityId;
  _id: EntityId;
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  trialDays: number;
  billingCycles: BillingCycle[];
  price: number;
  currency: string;
  features: PlanFeatures;
  isActive: boolean;
}

export interface PublicUser {
  id: EntityId;
  _id: EntityId;
  full_name: string;
  username: string;
  profile_picture: string;
}

export interface UserProfile extends PublicUser, Timestamped {
  bio: string;
  cover_photo: string;
  location: string;
  weight: number;
  height: number;
  followers_count: number;
  following_count: number;
  connections_count: number;
  statistics: UserStatistics;
  isFollowing?: boolean;
  isConnection?: boolean;
  connectionPending?: boolean;
}

export interface AuthUser extends PublicUser {
  email: string;
  bio: string;
  privacy: PrivacySettings;
  plan: Plan | EntityId | null;
}

export interface User extends UserProfile {
  email: string;
  role: Role;
  privacy: PrivacySettings;
  plan: Plan | EntityId | null;
  planStatus: PlanStatus;
  planStartDate: string | null;
  planEndDate: string | null;
  planCancelledAt: string | null;
}

export interface UserUpdateInput {
  username?: string;
  bio?: string;
  location?: string;
  full_name?: string;
  weight?: number;
  height?: number;
}

export interface Follow {
  followerId: EntityId;
  followeeId: EntityId;
  createdAt: string;
}

export interface Connection {
  id: EntityId;
  _id: EntityId;
  from_user_id: EntityId | PublicUser;
  to_user_id: EntityId | PublicUser;
  status: "pending" | "accepted";
  createdAt: string;
}

export type Permission = string;
