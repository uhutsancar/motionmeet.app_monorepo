import { createContext, useContext, type Dispatch, type SetStateAction } from "react";

export type AppThemeMode = "light" | "dark";

export interface AppThemeContextValue {
  theme: AppThemeMode;
  mode: AppThemeMode;
  setTheme: Dispatch<SetStateAction<AppThemeMode>>;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<AppThemeContextValue | null>(null);

export const useAppTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }

  return context;
};
