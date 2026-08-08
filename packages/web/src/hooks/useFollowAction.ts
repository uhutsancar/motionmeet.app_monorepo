import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import axios from "axios";
import { EMPTY_RELATIONSHIP, type ApiFailure, type RelationshipState } from "@motionmeet/shared";
import { useAuthContext } from "~/context/AuthProvider";
import { cancelFollowRequest, requestFollow, unfollowUser } from "~/api/endpoints";
import { setAuthorFollowState } from "~/features/posts/postsSlice";
import { setRelationship, setRelationshipPending } from "~/features/relationships/relationshipsSlice";
import { useAppDispatch, useAppSelector } from "~/app/hooks";

/**
 * The four states a follow button can be in, in the order the UI checks them.
 *
 * `follow_back` is deliberately distinct from `follow`: it means the other
 * account already follows this one, which is worth saying out loud even though
 * the click does exactly the same thing.
 */
export type FollowButtonState = "following" | "requested" | "follow_back" | "follow";

export const resolveFollowState = (relationship: RelationshipState): FollowButtonState => {
  if (relationship.isFollowing) return "following";
  if (relationship.requestSent) return "requested";
  if (relationship.isFollowedBy) return "follow_back";
  return "follow";
};

interface UseFollowActionResult {
  relationship: RelationshipState;
  state: FollowButtonState;
  label: string;
  /** True while a request is in flight for this user. */
  busy: boolean;
  /** Advances the relationship one step: follow -> requested -> following -> follow. */
  toggle: () => Promise<void>;
}

const errorMessage = (error: unknown, fallback: string): string => {
  const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
  return failure?.message || (error instanceof Error ? error.message : fallback);
};

export const useFollowAction = (
  userId: string | undefined,
  /** Server-supplied starting point, e.g. the flags carried on a feed post. */
  seed?: Partial<RelationshipState>,
): UseFollowActionResult => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const stored = useAppSelector((state) => (userId ? state.relationships.byUserId[userId] : undefined));
  const busy = useAppSelector((state) => (userId ? state.relationships.pending.includes(userId) : false));

  // Callers build the seed inline, so it is a fresh object on every render.
  // Reading the four flags out of it keeps the memo below keyed on values
  // rather than on identity, which is what makes `toggle` stable.
  const seedFollowing = seed?.isFollowing;
  const seedFollowedBy = seed?.isFollowedBy;
  const seedRequestSent = seed?.requestSent;
  const seedRequestReceived = seed?.requestReceived;

  // The store wins once it holds anything for this user, because it is what the
  // socket and the last action wrote; the seed only covers the first render.
  const relationship: RelationshipState = useMemo(
    () => ({
      ...EMPTY_RELATIONSHIP,
      isFollowing: Boolean(seedFollowing),
      isFollowedBy: Boolean(seedFollowedBy),
      requestSent: Boolean(seedRequestSent),
      requestReceived: Boolean(seedRequestReceived),
      ...stored,
    }),
    [seedFollowing, seedFollowedBy, seedRequestSent, seedRequestReceived, stored],
  );
  const state = resolveFollowState(relationship);

  const label = {
    following: t("feed.following_status", "Following"),
    requested: t("feed.follow_requested", "Requested"),
    follow_back: t("feed.follow_back", "Follow back"),
    follow: t("feed.follow", "Follow"),
  }[state];

  const toggle = useCallback(async () => {
    if (!userId || busy) return;
    dispatch(setRelationshipPending({ userId, pending: true }));
    // Undoing is optimistic because the outcome is certain. Following is not:
    // whether it lands on "Following" or "Requested" depends on the other
    // account's privacy, which only the server knows, so the button shows its
    // busy state until the answer comes back rather than guessing wrong and
    // flickering.
    const optimistic: Partial<RelationshipState> | null =
      state === "following"
        ? { isFollowing: false, requestSent: false }
        : state === "requested"
          ? { requestSent: false }
          : null;
    if (optimistic) dispatch(setRelationship({ userId, relationship: optimistic }));
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      const response =
        state === "following"
          ? await unfollowUser(userId, token)
          : state === "requested"
            ? await cancelFollowRequest(userId, token)
            : await requestFollow(userId, token);
      if (response?.relationship) {
        dispatch(setRelationship({ userId, relationship: response.relationship }));
        dispatch(setAuthorFollowState({ authorId: userId, isFollowing: response.relationship.isFollowing }));
      }
    } catch (error) {
      dispatch(setRelationship({ userId, relationship }));
      toast.error(errorMessage(error, t("feed.follow_failed", "The action could not be completed")));
    } finally {
      dispatch(setRelationshipPending({ userId, pending: false }));
    }
  }, [busy, dispatch, getToken, relationship, state, t, userId]);

  return { relationship, state, label, busy, toggle };
};
