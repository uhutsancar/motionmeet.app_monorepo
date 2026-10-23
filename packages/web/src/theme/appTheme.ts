import { createTheme, type Shadows } from "@mui/material/styles";
import type { AppThemeMode } from "~/context/appThemeContext";

const palettes = {
  light: {
    background: "#F7F7F5",
    paper: "#FFFFFF",
    surfaceLight: "#F0F1EE",
    divider: "#E2E4DE",
    // A second, much quieter rule for the outlines that only need to suggest an
    // edge — cards and panels — as opposed to the ones that separate two rows.
    dividerSoft: "rgba(23, 25, 31, 0.07)",
    textPrimary: "#17191F",
    textSecondary: "#646B78",
    textMuted: "#959BA7",
    primary: "#6558F5",
    primaryHover: "#5145DC",
    secondary: "#00A98F",
    energy: "#B5E853",
    coral: "#F7695E",
    success: "#0E9F6E",
    error: "#E5484D",
    warning: "#E89614",
    shadow: "rgba(22, 28, 45, 0.09)",
  },
  dark: {
    background: "#090A0D",
    paper: "#15171B",
    surfaceLight: "#1D2025",
    divider: "#2B2F36",
    dividerSoft: "rgba(255, 255, 255, 0.07)",
    textPrimary: "#F7F7F5",
    textSecondary: "#A8AFBA",
    textMuted: "#737B88",
    primary: "#9187FF",
    primaryHover: "#AAA2FF",
    secondary: "#3BD7B5",
    energy: "#C8F768",
    coral: "#FF7468",
    success: "#33C795",
    error: "#FF6B70",
    warning: "#F7B955",
    shadow: "rgba(0, 0, 0, 0.34)",
  },
};

const buildShadows = (shadow: string): Shadows =>
  createTheme().shadows.map((_, index) => {
    if (index === 0) return "none";
    if (index === 1) return `0 1px 2px ${shadow}`;
    if (index === 2) return `0 3px 10px ${shadow}`;
    if (index === 3) return `0 8px 24px ${shadow}`;
    if (index === 4) return `0 16px 40px ${shadow}`;
    if (index === 5) return `0 22px 60px ${shadow}`;
    return `0 18px 48px ${shadow}`;
  }) as Shadows;

export const createAppTheme = (mode: AppThemeMode) => {
  const colors = palettes[mode];
  const focusRing = mode === "dark"
    ? "rgba(138, 128, 255, 0.14)"
    : "rgba(101, 88, 245, 0.10)";

  return createTheme({
    cssVariables: true,
    palette: {
      mode,
      primary: {
        main: colors.primary,
        dark: colors.primaryHover,
        contrastText: "#FFFFFF",
      },
      secondary: { main: colors.secondary },
      success: { main: colors.success },
      error: { main: colors.error },
      warning: { main: colors.warning },
      info: { main: colors.energy },
      background: {
        default: colors.background,
        paper: colors.paper,
      },
      text: {
        primary: colors.textPrimary,
        secondary: colors.textSecondary,
        disabled: colors.textMuted,
      },
      divider: colors.divider,
      action: {
        hover: colors.surfaceLight,
        selected: colors.surfaceLight,
        focus: focusRing,
      },
    },
    /*
     * The app's type is set the way Instagram and Hevy set theirs on the web:
     * 14px running text, titles that stay under 24px and weights that stop at
     * 700. Headings at 800 with -0.03em tracking made every panel title read
     * like a marketing headline. The marketing pages set their own display
     * sizes and are not affected.
     */
    typography: {
      fontFamily: '"DM Sans", "Segoe UI", sans-serif',
      h1: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800, letterSpacing: "-0.035em" },
      h2: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800, letterSpacing: "-0.032em" },
      h3: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 700, letterSpacing: "-0.02em", fontSize: "1.5rem" },
      h4: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 700, letterSpacing: "-0.018em", fontSize: "1.375rem" },
      h5: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 700, letterSpacing: "-0.014em", fontSize: "1.1875rem" },
      h6: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 700, letterSpacing: "-0.01em", fontSize: "1rem" },
      subtitle1: { fontWeight: 600, fontSize: "0.9375rem" },
      subtitle2: { fontWeight: 600, fontSize: "0.875rem" },
      body1: { lineHeight: 1.5, fontSize: "0.9375rem" },
      body2: { lineHeight: 1.45, fontSize: "0.875rem" },
      caption: { fontSize: "0.75rem", lineHeight: 1.4 },
      // Small tracked capitals over every block read as costume; the label
      // role stays, set in sentence case at the caption size.
      overline: { fontSize: "0.75rem", lineHeight: 1.4, fontWeight: 600, letterSpacing: 0, textTransform: "none" },
      button: {
        textTransform: "none",
        fontWeight: 600,
        fontSize: "0.875rem",
        letterSpacing: 0,
      },
    },
    // MUI multiplies numeric sx borderRadius values by this base. Keeping the
    // token at 4 makes legacy 2/3/4 values resolve to a compact 8/12/16px.
    shape: { borderRadius: 4 },
    shadows: buildShadows(colors.shadow),
    transitions: {
      easing: {
        easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
        easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
        easeIn: "cubic-bezier(0.4, 0, 1, 1)",
        sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
      },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          /*
           * Instagram's buttons: a 32px slab, 8px corners, semibold label.
           * `size="large"` is kept for the one action a screen exists for.
           */
          root: {
            borderRadius: 8,
            minHeight: 34,
            paddingInline: 14,
            paddingBlock: 4,
            lineHeight: 1.4,
            transition: "background-color 160ms ease, opacity 160ms ease",
            "&:active": { opacity: 0.8 },
          },
          sizeSmall: { minHeight: 30, paddingInline: 12, fontSize: "0.8125rem" },
          sizeLarge: { minHeight: 40, paddingInline: 18, fontSize: "0.9375rem" },
          containedPrimary: {
            boxShadow: "none",
            "&:hover": { boxShadow: "none" },
          },
          // The secondary button is a soft grey fill with no outline, the way
          // Instagram draws "Edit profile" and "Message".
          outlined: {
            border: "none",
            backgroundColor: colors.surfaceLight,
            color: colors.textPrimary,
            "&:hover": { border: "none", backgroundColor: colors.divider },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
          rounded: { borderRadius: 12 },
          /*
           * An outlined panel gets the quiet rule, not the row separator.
           * MUI's default draws every card at full divider contrast, and a
           * screen of them reads as a grid of hard boxes; at this weight the
           * edge is still there when you look for it and disappears when you
           * are reading what is inside.
           */
          outlined: { border: `1px solid ${colors.dividerSoft}`, borderRadius: 12 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${colors.dividerSoft}`,
            borderRadius: 12,
            boxShadow: "none",
            transition: "border-color 160ms ease",
          },
        },
      },
      // Fields are 40px, not Material's 56px: a form of five fields no longer
      // fills the screen before the button.
      MuiTextField: {
        defaultProps: { variant: "outlined", size: "small" },
      },
      MuiInputBase: {
        styleOverrides: { input: { fontSize: "0.9375rem" } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: colors.surfaceLight,
            transition: "background-color 160ms ease, box-shadow 160ms ease",
            "&:hover": { backgroundColor: colors.paper },
            "&.Mui-focused": {
              backgroundColor: colors.paper,
              boxShadow: `0 0 0 4px ${focusRing}`,
            },
          },
          /*
           * The field is already a filled shape, so an outline round it as well
           * is one border too many. The focus ring is what says "you are here".
           */
          notchedOutline: { borderColor: "transparent" },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: 8, transition: "background-color 160ms ease", "&:active": { opacity: 0.7 } } },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: `1px solid ${colors.dividerSoft}`,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: '"Manrope", "DM Sans", sans-serif',
            fontWeight: 700,
            fontSize: "1.0625rem",
            paddingBlock: 14,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: { paper: { backgroundImage: "none" } },
      },
      MuiTooltip: {
        styleOverrides: { tooltip: { borderRadius: 10, fontSize: 12 } },
      },
      MuiAvatar: {
        styleOverrides: { root: { fontWeight: 600 } },
      },
      MuiTabs: {
        styleOverrides: { root: { minHeight: 40 }, indicator: { height: 2 } },
      },
      MuiTab: {
        styleOverrides: { root: { minHeight: 40, textTransform: "none", fontWeight: 600, fontSize: "0.875rem", paddingInline: 12 } },
      },
      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiListItemText: {
        styleOverrides: { primary: { fontSize: "0.875rem" }, secondary: { fontSize: "0.75rem" } },
      },
      MuiToggleButton: {
        styleOverrides: { root: { textTransform: "none", fontWeight: 600, paddingBlock: 4, borderRadius: 8 } },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: "background-color 0.22s ease, color 0.22s ease",
          },
        },
      },
    },
  });
};
