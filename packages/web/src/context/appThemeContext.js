import { createContext, useContext } from "react";

export const ThemeContext = createContext(null);

export const useAppTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }

  return context;
};

