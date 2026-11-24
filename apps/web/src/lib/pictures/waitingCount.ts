/**
 * The list the waiting-pictures count reads. It lives apart from the review
 * panel because the side panel, which is in the entry chunk, shows the same
 * number and must not pull the generated client in with it.
 */
export const WAITING_COUNT_API = "/profile-pictures?status=PENDING";
export const WAITING_COUNT_KEY = ["list-count", WAITING_COUNT_API] as const;
