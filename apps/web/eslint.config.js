// The shared OrderPilot config, plus browser globals for the files that run in
// the browser. The root config is not read for files in this folder.
import { orderpilot } from "@orderpilot/eslint-config";
import { defineConfig } from "eslint/config";

const browser = {
  window: "readonly",
  document: "readonly",
  localStorage: "readonly",
};

export default defineConfig(
  orderpilot({ tsconfigRootDir: import.meta.dirname }),
  {
    name: "orderpilot-web/browser-scripts",
    files: ["public/**/*.js"],
    languageOptions: { sourceType: "script", globals: browser },
  },
  {
    // The init script runs in the page, not in Node.
    name: "orderpilot-web/screenshot-script",
    files: ["scripts/screenshots.mjs"],
    languageOptions: { globals: { document: "readonly" } },
  },
);
