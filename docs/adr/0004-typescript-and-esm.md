# ADR 0004: Strict TypeScript and ES modules everywhere

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-5

## Context

CLAUDE.md asks for strict TypeScript, no `any`, and lint with no warnings. The API (NestJS, P-8), the web app (Vite and React, P-11) and the shared contracts (P-7) are all TypeScript, and the contracts are imported by both sides. Node 24 runs ES modules natively, and the tools we chose (ESLint 10, Vitest, Vite, NestJS 12) all support them.

TypeScript 7 exists, but typescript-eslint, which the type-aware lint needs, supports only TypeScript below 6.1, and the Nest CLI expects 6.0.

## Decision

1. **TypeScript 6.0, pinned at 6.0.3.** Dependabot ignores 6.1 and later until typescript-eslint supports them (ADR 0003).
2. **ES modules only.** Every `package.json` says `"type": "module"`. No CommonJS is written by hand.
3. **`packages/tsconfig`** (`@orderpilot/tsconfig`) holds three configs:
   - `base.json`: `strict`, plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, no unreachable code or unused labels, `verbatimModuleSyntax` and `isolatedModules`, targeting ES2024. `types` is empty, so each package names the global types it uses;
   - `node.json`: `module` and `moduleResolution` `nodenext`, with Node's types, for the API, the mock and the scripts;
   - `react.json`: `moduleResolution` `bundler`, the DOM libraries and `jsx: react-jsx`, for the web app under Vite.
     Packages extend one of them and add only what they need, such as Nest's decorator settings.
4. **`packages/eslint-config`** (`@orderpilot/eslint-config`) is one flat config:
   - ESLint's recommended rules for every file;
   - typescript-eslint's `strictTypeChecked` and `stylisticTypeChecked` for TypeScript, type-aware through the project service, with `no-explicit-any` and `consistent-type-imports` as errors;
   - eslint-plugin-jsx-a11y's strict rules for JSX and TSX;
   - safety rules: `eqeqeq`, and a ban on Prisma's `$queryRawUnsafe` and `$executeRawUnsafe`;
   - unused `eslint-disable` comments are errors, every rule that a preset sets to "warn" becomes "error", and `pnpm lint` passes `--max-warnings 0` as well.
     Its tests lint fixtures with known faults (an `any`, a floating promise, an image without alt text, a clickable `div`) and fail if any one is missed, so an update that drops a rule shows up at once.
5. **The repository scripts are JavaScript checked as TypeScript.** `scripts/**/*.mjs` run with plain `node`, with no build step, and carry JSDoc types. The root `tsconfig.json` checks them with `checkJs` under the same strict options, and `pnpm typecheck` runs it. Type-aware lint rules apply to TypeScript files only, since plain JavaScript carries no declared types for them to use.

## Consequences

- One set of strict options for every package, and shared types between the API and the web app with no translation layer.
- `noUncheckedIndexedAccess` makes every array and record lookup possibly `undefined`. That is more code, and it is the point: it catches the missing-row bugs that matter in order data.
- Type-aware lint is slower than plain lint. We accept that for rules like `no-floating-promises`, which catch real bugs.
- Some older packages ship only CommonJS. Node's ESM can import them, and any that cannot be imported are recorded in the story that adds them.
- Moving to TypeScript 7 is a later decision, with its own ADR, once typescript-eslint and the Nest CLI support it.
