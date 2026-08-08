import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import type { SxProps, Theme } from "@mui/material/styles";
import type { RelationshipState } from "@motionmeet/shared";
import { useFollowAction } from "~/hooks/useFollowAction";

interface FollowButtonProps {
  userId: string | undefined;
  /** Server-supplied starting point, e.g. the flags carried on a feed post. */
  seed?: Partial<RelationshipState>;
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * The single follow control for the whole web app.
 *
 * "Following" and "Requested" are settled states and render quietly as outlined
 * buttons; "Follow" and "Follow back" are calls to action and stay filled.
 */
const FollowButton = ({ userId, seed, size = "small", fullWidth = false, sx = {} }: FollowButtonProps) => {
  const { state, label, busy, toggle } = useFollowAction(userId, seed);
  const settled = state === "following" || state === "requested";

  return (
    <Button
      size={size}
      fullWidth={fullWidth}
      variant={settled ? "outlined" : "contained"}
      color={settled ? "inherit" : "primary"}
      disabled={busy || !userId}
      onClick={() => { void toggle(); }}
      startIcon={busy ? <CircularProgress size={13} color="inherit" /> : null}
      sx={[{ fontWeight: 800, whiteSpace: "nowrap", minWidth: 96 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {label}
    </Button>
  );
};

export default FollowButton;
