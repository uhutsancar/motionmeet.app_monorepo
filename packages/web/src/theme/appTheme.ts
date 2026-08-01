import { createTheme, type Shadows } from "@mui/material/styles";
import type { AppThemeMode } from "~/context/appThemeContext";

const palettes = {
  light: {
    background: "#F7F7F5",
    paper: "#FFFFFF",
    surfaceLight: "#F0F1EE",
    divider: "#E2E4DE",
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
    typography: {
      fontFamily: '"DM Sans", "Segoe UI", sans-serif',
      h1: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800, letterSpacing: "-0.035em" },
      h2: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800, letterSpacing: "-0.032em" },
      h3: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800, letterSpacing: "-0.03em", fontSize: "2rem" },
      h4: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800, letterSpacing: "-0.028em", fontSize: "1.75rem" },
      h5: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 750, letterSpacing: "-0.024em", fontSize: "1.375rem" },
      h6: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 750, letterSpacing: "-0.02em", fontSize: "1.0625rem" },
      subtitle1: { fontWeight: 700 },
      subtitle2: { fontWeight: 700 },
      body1: { lineHeight: 1.55 },
      body2: { lineHeight: 1.5, fontSize: "0.875rem" },
      button: {
        textTransform: "none",
        fontWeight: 800,
        letterSpacing: "-0.01em",
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
          root: {
            borderRadius: 10,
            minHeight: 40,
            paddingInline: 16,
            transition: "transform 180ms cubic-bezier(.16,1,.3,1), box-shadow 180ms ease, background-color 180ms ease",
            "&:active": { transform: "translateY(1px)" },
          },
          containedPrimary: {
            boxShadow: "none",
            "&:hover": { boxShadow: "none" },
          },
          outlined: {
            borderColor: colors.divider,
            backgroundColor: mode === "dark" ? "rgba(18, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.72)",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
          rounded: { borderRadius: 14 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${colors.divider}`,
            borderRadius: 14,
            boxShadow: "none",
            transition: "transform 180ms cubic-bezier(.16,1,.3,1), border-color 180ms ease, box-shadow 180ms ease",
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: "outlined" },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: colors.surfaceLight,
            transition: "background-color 160ms ease, box-shadow 160ms ease",
            "&:hover": { backgroundColor: colors.paper },
            "&.Mui-focused": {
              backgroundColor: colors.paper,
              boxShadow: `0 0 0 4px ${focusRing}`,
            },
          },
          notchedOutline: { borderColor: colors.divider },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: 10, transition: "transform 160ms ease, background-color 160ms ease", "&:active": { transform: "scale(.94)" } } },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 10, fontWeight: 700 } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: `1px solid ${colors.divider}`,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: '"Manrope", "DM Sans", sans-serif',
            fontWeight: 750,
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
        styleOverrides: { root: { fontWeight: 800 } },
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
