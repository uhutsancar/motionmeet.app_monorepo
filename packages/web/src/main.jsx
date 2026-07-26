import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n"; // Import i18n before App
import App from "./App.jsx";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./context/AuthProvider.jsx";
import { Provider } from "react-redux";
import { store } from "./app/store.js";
import { ThemeProvider } from "./context/ThemeContext";
import GlobalStyles from "@mui/material/GlobalStyles";
import { StyledEngineProvider } from "@mui/material/styles";

createRoot(document.getElementById("root")).render(
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
