import i18n, { i18nReady } from "@/i18n";

// The sign-in words are their own file, so the entry bundle does not carry
// them. Asking for it here, as the form's chunk loads, starts the request at
// the earliest moment instead of when the form first renders.
void i18nReady.then(() => i18n.loadNamespaces("signin"));
