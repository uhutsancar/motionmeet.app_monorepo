import { createRoot } from "react-dom/client";
import "./index.css";
import { initI18n } from "./i18n"; // Import i18n before App
import App from "./App";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./context/AuthProvider";
import { Provider } from "react-redux";
import { store } from "./app/store.js";
import { ThemeProvider } from "./context/ThemeContext";
import GlobalStyles from "@mui/material/GlobalStyles";
import { StyledEngineProvider } from "@mui/material/styles";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("MotionMeet root element was not found");

// Only English ships in the entry bundle; any other saved language is fetched
// first so the first paint is already in the right one.
await initI18n();

createRoot(rootElement).render(
  <StyledEngineProvider enableCssLayer>
    <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Provider store={store}>
            <App />
          </Provider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </StyledEngineProvider>
);
