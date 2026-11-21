import type { Session } from "@orderpilot/shared";
import { forgetShown, queryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";

/**
 * Every session the tab is given passes here: a sign-in, the me call and a
 * silent refresh. When it hands the tab to another person, whether the earlier
 * session ended while its page was open or is still open (a change of role
 * from the menu), what that person was shown goes first. The store is given the
 * new person only afterwards, so no render can pair the new name with the
 * earlier figures. It waits for the answer, not before: emptying earlier would
 * let the page ask again as the earlier person. The same person arriving again
 * (a refresh, the me call) keeps the page.
 *
 * Its own file so the API client's instance and the sign-in calls can both
 * import it: it needs the query client and the store, and not the other way.
 */
export function adoptSession(session: Session): void {
  const before = useSessionStore.getState();
  if (before.session !== null && before.session.user.id !== session.user.id) {
    forgetShown(queryClient);
  }
  before.setSession(session);
}
