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
  /** `link`: the accent word Instagram puts beside a name, with no fill. */
  appearance?: "button" | "link";
  sx?: SxProps<Theme>;
}

/**
 * The single follow control for the whole web app.
 *
 * "Following" and "Requested" are settled states and render quietly as outlined
 * buttons; "Follow" and "Follow back" are calls to action and stay filled.
 */
const FollowButton = ({ userId, seed, size = "small", fullWidth = false, appearance = "button", sx = {} }: FollowButtonProps) => {
  const { state, label, busy, toggle } = useFollowAction(userId, seed);
  const settled = state === "following" || state === "requested";

  if (appearance === "link") {
    return (
      <Button
        size="small"
        variant="text"
        color={settled ? "inherit" : "primary"}
        disabled={busy || !userId}
        onClick={() => { void toggle(); }}
        sx={[
          {
            minWidth: 0,
            minHeight: 28,
            px: 0.75,
            fontWeight: 600,
            whiteSpace: "nowrap",
            color: settled ? "text.secondary" : "primary.main",
            "&:hover": { backgroundColor: "transparent", opacity: 0.7 },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {busy ? <CircularProgress size={13} color="inherit" /> : label}
      </Button>
    );
  }

  return (
    <Button
      size={size}
      fullWidth={fullWidth}
      variant={settled ? "outlined" : "contained"}
      color={settled ? "inherit" : "primary"}
      disabled={busy || !userId}
      onClick={() => { void toggle(); }}
      startIcon={busy ? <CircularProgress size={13} color="inherit" /> : null}
      sx={[{ fontWeight: 600, whiteSpace: "nowrap", minWidth: 88 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {label}
    </Button>
  );
};

export default FollowButton;
