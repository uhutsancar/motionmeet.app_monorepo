import { useEffect, useMemo, useState } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { createAppTheme } from "../theme/appTheme";
import { ThemeContext } from "./appThemeContext";

const getInitialTheme = () => {
    const storedTheme = localStorage.getItem("appTheme");
    return storedTheme === "dark" ? "dark" : "light";
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(getInitialTheme);
    const muiTheme = useMemo(() => createAppTheme(theme), [theme]);

    useEffect(() => {
        localStorage.setItem("appTheme", theme);
        const root = window.document.documentElement;
        root.classList.toggle("dark", theme === "dark");
        root.style.colorScheme = theme;
    }, [theme]);

    const value = useMemo(() => ({
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
