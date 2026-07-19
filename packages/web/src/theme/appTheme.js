import { createTheme } from "@mui/material/styles";

const palettes = {
  light: {
    background: "#F9FAFB",
    paper: "#FFFFFF",
    surfaceLight: "#F3F4F6",
    divider: "#E5E7EB",
    textPrimary: "#111827",
    textSecondary: "#4B5563",
    textMuted: "#9CA3AF",
    primary: "#3B82F6",
    primaryHover: "#2563EB",
  },
  dark: {
    background: "#0C0C0E",
    paper: "#141417",
    surfaceLight: "#1F1F23",
    divider: "#252529",
    textPrimary: "#F3F4F6",
    textSecondary: "#9CA3AF",
    textMuted: "#6B7280",
    primary: "#60A5FA",
    primaryHover: "#93C5FD",
  },
};

export const createAppTheme = (mode) => {
  const colors = palettes[mode] || palettes.light;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary,
        dark: colors.primaryHover,
      },
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
      },
    },
    typography: {
      fontFamily: '"Outfit", "Open Sans", sans-serif',
      button: {
        textTransform: "none",
        fontWeight: 700,
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: "background-color 0.3s ease, color 0.3s ease",
          },
        },
      },
    },
  });
};
