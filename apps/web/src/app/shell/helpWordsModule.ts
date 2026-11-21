import i18n from "@/i18n";
import { deferredModule } from "@/lib/deferred";

/**
 * Help's "What the words mean", fetched with its text (the `components`
 * namespace) so that it draws at once when it arrives and never suspends the
 * panel it sits in.
 */
export const helpWordsModule = deferredModule(async () => {
  const [module] = await Promise.all([
    import("./HelpWords"),
    i18n.loadNamespaces("components"),
  ]);
  return module;
});
