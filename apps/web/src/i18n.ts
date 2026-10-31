import i18n, { type BackendModule } from "i18next";
import { initReactI18next } from "react-i18next";
import common from "./locales/en/common.json";

// One file per feature namespace, each its own chunk: an area's text never
// grows the entry bundle. Only `common` ships in the entry.
const lazyNamespaces = import.meta.glob<{ default: Record<string, unknown> }>([
  "./locales/*/*.json",
  "!./locales/*/common.json",
]);

const lazyBackend: BackendModule = {
  type: "backend",
  init() {
    // Nothing to set up.
  },
  read(language, namespace, callback) {
    const load = lazyNamespaces[`./locales/${language}/${namespace}.json`];
    if (!load) {
      callback(new Error(`No translations for ${language}/${namespace}`), null);
      return;
    }
    load().then(
      (module) => {
        callback(null, module.default);
      },
      (error: unknown) => {
        callback(
          error instanceof Error ? error : new Error("load failed"),
          null,
        );
      },
    );
  },
};

export const i18nReady = i18n
  .use(lazyBackend)
  .use(initReactI18next)
  .init({
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en"],
    defaultNS: "common",
    ns: ["common"],
    resources: { en: { common } },
    partialBundledLanguages: true,
    interpolation: { escapeValue: false },
    react: { useSuspense: true },
  });

export default i18n;
