import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
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
  /** Optional chip under the name, e.g. the nearby distance band. */
  badge?: string;
  /**
   * Replaces the follower count, e.g. an approximate area. Pass an empty string
   * to drop the line entirely — callers whose users carry no follower count
   * must not fall through to a hardcoded "0 followers".
   */
  caption?: string;
}

const UserCard = ({ user, width = 232, badge, caption }: UserCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const secondaryLine = caption ?? `${user.followers_count ?? 0} ${t("feed.followers", "followers")}`;

  return (
    <Paper
      variant="outlined"
      sx={{ width, flexShrink: 0, p: 1.5, borderRadius: 3, display: "flex", flexDirection: "column", gap: 1.25 }}
    >
      <ButtonBase
        onClick={() => navigate(`/profile/${user._id}`)}
        sx={{ borderRadius: 2, justifyContent: "flex-start", textAlign: "left", p: 0.25 }}
      >
        <Stack direction="row" spacing={1.25} sx={{ minWidth: 0, alignItems: "center", width: "100%" }}>
          <Avatar src={user.profile_picture || undefined} alt={user.full_name} sx={{ width: 44, height: 44 }}>
            {(user.full_name || user.username || "U").charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>
              {user.full_name || user.username}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              @{user.username || "member"}
            </Typography>
            {secondaryLine && (
              <Typography variant="caption" color="text.disabled" noWrap sx={{ display: "block" }}>
                {secondaryLine}
              </Typography>
            )}
          </Box>
        </Stack>
      </ButtonBase>

      {badge && <Chip size="small" label={badge} sx={{ alignSelf: "flex-start", height: 22, fontSize: 10, fontWeight: 800 }} />}

      <FollowButton
        fullWidth
        userId={user._id}
        seed={{
          isFollowing: Boolean(user.isFollowing),
          isFollowedBy: Boolean(user.isFollowedBy),
          requestSent: Boolean(user.requestSent),
          requestReceived: Boolean(user.requestReceived),
        }}
      />
    </Paper>
  );
};

export default UserCard;
