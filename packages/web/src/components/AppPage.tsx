import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  maxWidth?: number | string;
  sx?: SxProps<Theme>;
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  onBack?: () => void;
}

interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actionLabel?: ReactNode;
  onAction?: () => void;
  minHeight?: number | string;
}

/**
 * The frame every signed-in page sits in.
 *
 * Tighter than it was, top and sides. A page that begins a third of the way
 * down the viewport reads as a document with a masthead; the content is what
 * people came for, so it starts close to the top and uses the width it has.
 */
export const PageShell = ({ children, maxWidth = 1200, sx = {} }: PageShellProps) => (
  <Box sx={{ width: "100%", minHeight: "100%", py: { xs: 1.5, md: 2 }, px: { xs: 1.5, sm: 2.5, lg: 4 } }}>
    <Stack spacing={2.25} sx={[{ width: "100%", maxWidth, mx: "auto" }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Stack>
  </Box>
);

/**
 * The title block at the top of a page.
 *
 * One component, so shrinking it here shrinks it on all seventeen pages that
 * use it. The heading used to be 28px with an outlined tile beside it and an
 * outlined circle before that — three hard edges and a lot of height spent on
 * repeating the name of the page the reader had just navigated to. It is a
 * heading now: smaller, no outlines, and the icon is a soft tint rather than a
 * boxed badge.
 */
export const PageHeader = ({
  title,
  description = "",
  eyebrow = "",
  icon: Icon,
  action = null,
  onBack,
}: PageHeaderProps) => (
  <Stack
    direction={{ xs: "column", sm: "row" }}
    spacing={2}
    sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}
  >
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
      {onBack && (
        <IconButton
          aria-label="Back"
          onClick={onBack}
          sx={{ width: 38, height: 38 }}
        >
          <ArrowBackRounded fontSize="small" />
        </IconButton>
      )}
      {Icon && (
        <Box
          sx={{
            width: 34,
            height: 34,
            display: { xs: "none", sm: "grid" },
            placeItems: "center",
            flexShrink: 0,
            color: "primary.main",
            bgcolor: "action.hover",
            borderRadius: "50%",
          }}
        >
          <Icon size={18} />
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography
            variant="overline"
            color="primary.main"
            sx={{ display: "block", mb: 0.1, fontSize: 10, fontWeight: 800, lineHeight: 1.4, letterSpacing: "0.12em" }}
          >
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" sx={{ fontSize: { xs: 19, sm: 21 }, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
            {description}
          </Typography>
        )}
      </Box>
    </Stack>
    {action}
  </Stack>
);

export const SectionHeader = ({ title, description = "", action = null }: SectionHeaderProps) => (
  <Stack direction="row" spacing={2} sx={{ alignItems: "flex-end", justifyContent: "space-between" }}>
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography>
      {description && <Typography variant="caption" color="text.secondary">{description}</Typography>}
    </Box>
    {action}
  </Stack>
);

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel = "",
  onAction,
  minHeight = 220,
}: EmptyStateProps) => (
  <Paper
    elevation={0}
    sx={{
      minHeight,
      p: 3,
      display: "grid",
      placeItems: "center",
      borderRadius: 3.5,
      bgcolor: "action.hover",
    }}
  >
    <Stack spacing={1.25} sx={{ maxWidth: 360, alignItems: "center", textAlign: "center" }}>
      {Icon && (
        <Box sx={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 2.5, bgcolor: "action.hover", color: "text.secondary" }}>
          <Icon size={21} />
        </Box>
      )}
      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography>
      {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}
      {actionLabel && (
        <Button variant="contained" onClick={onAction} sx={{ mt: 0.75 }}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  </Paper>
);
