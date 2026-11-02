// Everything a spec needs, from one place. Import `test` and `expect` from
// here, never from "@playwright/test", so every page is watched.
export { checkPage, SIZES, WCAG_TAGS } from "./check-page.js";
export { BASE_URL, apiUrl } from "./env.js";
export { expect, test, type E2eOptions } from "./fixtures.js";
export { expectNoButton, expectRefused, type Method } from "./refusals.js";
export { SMOKE_PAGES, type SmokePage } from "./roles.js";
export { signInAs, type SignInOptions } from "./session.js";
export { expectRealPage } from "./real-page.js";
