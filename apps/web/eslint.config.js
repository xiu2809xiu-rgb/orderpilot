// The shared OrderPilot config, plus browser globals for the files that run in
// the browser. The root config is not read for files in this folder.
import { orderpilot } from "@orderpilot/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

const browser = {
  window: "readonly",
  document: "readonly",
  localStorage: "readonly",
};

// The files the first screen loads before it paints: the entry chunk, under
// the 250 KB budget. They may not pull in a whole kit or area. The rule is in
// docs/architecture/patterns.md ("The entry chunk: what the shell may import").
const entryFiles = [
  "src/main.tsx",
  "src/i18n.ts",
  "src/zod-setup.ts",
  "src/app/{App,RootLayout,router,guards,Splash,Logo}.tsx",
  "src/app/pages/{CrashPage,ForbiddenPage}.tsx",
  "src/app/shell/{AppShell,Sidebar,Topbar,Breadcrumbs,Notifications,RoleSwitcher,RoleItem,ThemeSwitch,UserMenu}.tsx",
  "src/app/shell/shortcuts.ts",
  "src/stores/*.ts",
  "src/features/{registry,nav,define}.ts",
  "src/features/*/index.{ts,tsx}",
  "src/features/*/routes.tsx",
  "src/lib/api/{auth,client,instance,cookies}.ts",
  "src/lib/{query,theme,utils,deferred}.ts",
  // Availability: the dot and the data hooks are in the shell (ADR 0070).
  "src/components/kit/availability-picker/{tones.ts,AvailabilityDot.tsx,AvailabilityTrigger.tsx,AvailabilityControl.tsx}",
  "src/lib/{useAvailability,useAvailabilityOf,useExpiryTimer}.ts",
];
const lazyUi = [
  "alert-dialog",
  "command",
  "dialog",
  "dropdown-menu",
  "popover",
  "select",
  "sheet",
  "tooltip",
];

export default defineConfig(
  // Written by orval (ADR 0019) and compared byte for byte by pnpm api:check.
  // This folder is the only path the checks skip.
  globalIgnores(["src/lib/api/generated/"]),
  orderpilot({ tsconfigRootDir: import.meta.dirname }),
  {
    name: "orderpilot-web/entry-chunk",
    files: entryFiles,
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/common",
              message:
                "The barrel puts every common component in the entry chunk. Import the file, such as @/components/common/skeletons.",
              allowTypeImports: true,
            },
            ...lazyUi.map((name) => ({
              name: `@/components/ui/${name}`,
              message:
                "This overlay opens on a click, so keep it out of the entry chunk: use the facade in @/app/shell/overlays, or lazy-load the component that needs it.",
              allowTypeImports: true,
            })),
          ],
          patterns: [
            {
              group: ["@/lib/api/generated/**"],
              message:
                "The generated client brings a whole area's endpoints. Call apiClient from the entry, or lazy-load the component that needs the hook.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    name: "orderpilot-web/browser-scripts",
    files: ["public/**/*.js"],
    languageOptions: { sourceType: "script", globals: browser },
  },
  {
    // The init script runs in the page, not in Node.
    name: "orderpilot-web/screenshot-script",
    files: ["scripts/screenshots.mjs", "scripts/screenshots-components.mjs"],
    languageOptions: { globals: { document: "readonly" } },
  },
);
