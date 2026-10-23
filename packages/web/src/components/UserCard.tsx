import Avatar from "@mui/material/Avatar";
import Paper from "@mui/material/Paper";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { PublicUser } from "@motionmeet/shared";
import FollowButton from "./FollowButton";

interface SuggestedUser extends Partial<PublicUser> {
  _id: string;
  full_name?: string;
  username?: string;
  profile_picture?: string;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  requestSent?: boolean;
  requestReceived?: boolean;
  followers_count?: number;
}

interface UserCardProps {
  user: SuggestedUser;
  /** Set by rails so every card matches the row it is rendered in. */
  width?: number | string;
  /** A short fact under the name, e.g. the nearby distance band. */
  badge?: string;
  /**
   * Replaces the follower count, e.g. an approximate area. Pass an empty string
   * to drop the line entirely — callers whose users carry no follower count
   * must not fall through to a hardcoded "0 followers".
   */
  caption?: string;
}

/**
 * A person in a horizontal rail, drawn the way Instagram's "Suggested for you"
 * cards are: a picture large enough to recognise someone by, the name under
 * it, one small Follow button at the foot. The whole card opens the profile.
 */
const UserCard = ({ user, width = 168, badge, caption }: UserCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const followers = user.followers_count ?? 0;
  const secondaryLine = caption ?? (followers > 0
    ? t("feed.followers_count", { count: followers, defaultValue: "{{count}} takipçi" })
    : t("feed.suggested_for_you", "Senin için önerildi"));

  return (
    <Paper
      variant="outlined"
      sx={{ width, flexShrink: 0, p: 1.5, pt: 2, borderRadius: 2.5, display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <ButtonBase
        onClick={() => navigate(`/profile/${user._id}`)}
        sx={{ borderRadius: 2, flexDirection: "column", width: "100%", p: 0.25 }}
      >
        <Avatar src={user.profile_picture || undefined} alt={user.full_name} sx={{ width: 72, height: 72, fontSize: 26, fontWeight: 500 }}>
          {(user.full_name || user.username || "U").charAt(0).toUpperCase()}
        </Avatar>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600, mt: 1.25, maxWidth: "100%" }}>
          {user.full_name || user.username}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: "100%" }}>
          {[badge, secondaryLine].filter(Boolean).join(" · ") || `@${user.username || "member"}`}
        </Typography>
      </ButtonBase>

      <FollowButton
        fullWidth
        userId={user._id}
        seed={{
          isFollowing: Boolean(user.isFollowing),
          isFollowedBy: Boolean(user.isFollowedBy),
          requestSent: Boolean(user.requestSent),
          requestReceived: Boolean(user.requestReceived),
        }}
        sx={{ mt: 1.5, minHeight: 30 }}
      />
    </Paper>
  );
};

export default UserCard;
