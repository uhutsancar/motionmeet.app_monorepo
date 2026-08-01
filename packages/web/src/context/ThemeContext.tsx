import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { createAppTheme } from "../theme/appTheme";
import { ThemeContext, type AppThemeContextValue, type AppThemeMode } from "./appThemeContext";

const getInitialTheme = (): AppThemeMode => {
    const storedTheme = localStorage.getItem("appTheme");
    return storedTheme === "dark" ? "dark" : "light";
};

export const ThemeProvider = ({ children }: PropsWithChildren) => {
    const [theme, setTheme] = useState<AppThemeMode>(getInitialTheme);
    const muiTheme = useMemo(() => createAppTheme(theme), [theme]);

    useEffect(() => {
        localStorage.setItem("appTheme", theme);
        const root = window.document.documentElement;
        root.classList.toggle("dark", theme === "dark");
        root.style.colorScheme = theme;
    }, [theme]);

    const value = useMemo<AppThemeContextValue>(() => ({
        theme,
        mode: theme,
        setTheme,
        toggleTheme: () => setTheme((previous) => previous === "dark" ? "light" : "dark"),
    }), [theme]);

    return (
        <ThemeContext.Provider value={value}>
            <MuiThemeProvider theme={muiTheme}>
                <CssBaseline enableColorScheme />
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
};
