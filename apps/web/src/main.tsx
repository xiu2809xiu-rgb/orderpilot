import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./zod-setup";
import { App } from "./app/App";
import { Splash } from "./app/Splash";
import { i18nReady } from "./i18n";
import { initTheme } from "./lib/theme";
import "./styles/index.css";

initTheme();

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
