import type { EntityId, Timestamped } from "./common.js";
import type { ProfileLocation } from "./location.js";

export type Role = "user" | "admin" | "superadmin";

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

export interface PublicUser {
  id: EntityId;
  _id: EntityId;
  full_name: string;
  username: string;
  profile_picture: string;
}

/**
 * Everything the UI needs to pick between Follow / Requested / Following /
 * Follow back / Confirm. The two directions are independent: A following B says
 * nothing about B following A.
 */
export interface RelationshipState {
  /** Viewer follows this account. */
  isFollowing: boolean;
  /** This account follows the viewer, so the viewer can follow back. */
  isFollowedBy: boolean;
  /** Viewer has a follow request awaiting this account's approval. */
  requestSent: boolean;
  /** This account asked to follow the viewer and is awaiting approval. */
  requestReceived: boolean;
  /** Legacy two-way connection, kept for presence and messaging. */
  isConnection: boolean;
  connectionPending: boolean;
}

export const EMPTY_RELATIONSHIP: RelationshipState = Object.freeze({
  isFollowing: false,
  isFollowedBy: false,
  requestSent: false,
  requestReceived: false,
  isConnection: false,
  connectionPending: false,
});

export interface UserProfile extends PublicUser, Timestamped {
  bio: string;
  cover_photo: string;
  /** Rendered profile-location label, written by the backend. Empty when unset. */
  location: string;
  /**
   * The dataset record behind `location`. Present on the account owner's own
   * payload so the editor can pre-select; omitted for other people's profiles,
   * which only need the label.
   */
  profileLocation?: ProfileLocation | null;
  weight: number;
  height: number;
  followers_count: number;
  following_count: number;
  connections_count: number;
  statistics: UserStatistics;
  isFollowing?: boolean;
  isConnection?: boolean;
  connectionPending?: boolean;
  isFollowedBy?: boolean;
  requestSent?: boolean;
  requestReceived?: boolean;
  /** True when the account is private and the viewer may not see its content. */
  isPrivate?: boolean;
  /** False when a private account is hiding its posts and stories from the viewer. */
  canViewContent?: boolean;
  /** False when the viewer is not allowed to open a chat with this account. */
  canMessage?: boolean;
}

export interface AuthUser extends PublicUser {
  email: string;
  bio: string;
  privacy: PrivacySettings;
}

export interface User extends UserProfile {
  email: string;
  role: Role;
  privacy: PrivacySettings;
}

export interface UserUpdateInput {
  username?: string;
  bio?: string;
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
