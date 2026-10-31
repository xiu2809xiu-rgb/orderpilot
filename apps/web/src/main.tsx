import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./zod-setup";
import { App } from "./app/App";
import { Splash } from "./app/Splash";
import { i18nReady } from "./i18n";
import { initWebSentry } from "./lib/monitoring/sentry";
import { initTheme } from "./lib/theme";
import "./styles/index.css";

initTheme();
// Loads the Sentry chunk only when VITE_SENTRY_DSN is set (ADR 0022).
void initWebSentry(import.meta.env.VITE_SENTRY_DSN, {
  environment: import.meta.env.MODE,
});

const container = document.getElementById("root");
if (!container) throw new Error("The page has no #root element.");

void i18nReady.then(() => {
  container.removeAttribute("aria-busy");
  createRoot(container).render(
    <StrictMode>
      <Suspense fallback={<Splash />}>
        <App />
      </Suspense>
    </StrictMode>,
  );
});
