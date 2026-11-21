import { useSessionStore } from "@/stores/session";
import { adoptSession } from "./adopt-session";
import { ApiClient } from "./client";

/** The app's one client. It tells the session store when a session changes. */
export const apiClient = new ApiClient({
  onSessionEnded: () => {
    useSessionStore.getState().setExpired();
  },
  onSessionRefreshed: adoptSession,
});
