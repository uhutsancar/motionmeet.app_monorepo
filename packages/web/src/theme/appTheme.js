import { createTheme } from "@mui/material/styles";

const palettes = {
  light: {
    background: "#F5F6FA",
    paper: "#FFFFFF",
    surfaceLight: "#EEF1F7",
    divider: "#E2E6EF",
    textPrimary: "#171A2B",
    textSecondary: "#61677A",
    textMuted: "#9298AA",
    primary: "#6558F5",
    primaryHover: "#5145DB",
    secondary: "#12A88A",
    success: "#0E9F6E",
    error: "#E5484D",
    warning: "#E89614",
    shadow: "rgba(22, 28, 45, 0.09)",
  },
  dark: {
    background: "#090D18",
    paper: "#121827",
    surfaceLight: "#1A2234",
    divider: "#273247",
    textPrimary: "#F7F8FC",
    textSecondary: "#AEB7C9",
    textMuted: "#747F96",
    primary: "#8A80FF",
    primaryHover: "#A199FF",
    secondary: "#38D2B0",
    success: "#33C795",
    error: "#FF6B70",
    warning: "#F7B955",
    shadow: "rgba(0, 0, 0, 0.34)",
  },
};

const buildShadows = (shadow) => [
  "none",
  `0 1px 2px ${shadow}`,
  `0 3px 10px ${shadow}`,
  `0 8px 24px ${shadow}`,
  `0 16px 40px ${shadow}`,
  `0 22px 60px ${shadow}`,
  ...Array(19).fill(`0 18px 48px ${shadow}`),
];

export const createAppTheme = (mode) => {
  const colors = palettes[mode] || palettes.light;
  const focusRing = mode === "dark"
    ? "rgba(138, 128, 255, 0.14)"
    : "rgba(101, 88, 245, 0.10)";

  return createTheme({
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
      fontFamily: '"Manrope", "Segoe UI", sans-serif',
      h1: { fontFamily: '"Sora", "Manrope", sans-serif', fontWeight: 800, letterSpacing: "-0.045em" },
      h2: { fontFamily: '"Sora", "Manrope", sans-serif', fontWeight: 800, letterSpacing: "-0.04em" },
      h3: { fontFamily: '"Sora", "Manrope", sans-serif', fontWeight: 750, letterSpacing: "-0.035em" },
      h4: { fontFamily: '"Sora", "Manrope", sans-serif', fontWeight: 750, letterSpacing: "-0.03em" },
      h5: { fontFamily: '"Sora", "Manrope", sans-serif', fontWeight: 700, letterSpacing: "-0.025em" },
      h6: { fontFamily: '"Sora", "Manrope", sans-serif', fontWeight: 700, letterSpacing: "-0.02em" },
      subtitle1: { fontWeight: 700 },
      subtitle2: { fontWeight: 700 },
      body1: { lineHeight: 1.65 },
      body2: { lineHeight: 1.55 },
      button: {
        textTransform: "none",
        fontWeight: 800,
        letterSpacing: "-0.01em",
      },
    },
    shape: { borderRadius: 16 },
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
            borderRadius: 14,
            minHeight: 42,
            paddingInline: 18,
            transition: "transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
            "&:active": { transform: "translateY(1px)" },
          },
          containedPrimary: {
            boxShadow: "0 8px 22px rgba(101, 88, 245, 0.22)",
            "&:hover": { boxShadow: "0 11px 28px rgba(101, 88, 245, 0.30)" },
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
          rounded: { borderRadius: 20 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${colors.divider}`,
            borderRadius: 20,
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: "outlined" },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            backgroundColor: mode === "dark" ? "rgba(9, 13, 24, 0.38)" : "rgba(248, 249, 252, 0.82)",
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
        styleOverrides: { root: { borderRadius: 13 } },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 10, fontWeight: 700 } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 24,
            border: `1px solid ${colors.divider}`,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: '"Sora", "Manrope", sans-serif',
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
