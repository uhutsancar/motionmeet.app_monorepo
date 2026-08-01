import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n"; // Import i18n before App
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
