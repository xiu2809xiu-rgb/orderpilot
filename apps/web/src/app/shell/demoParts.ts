import { hasPermission, useSessionStore } from "@/stores/session";

/** Where the upload and review page lives. */
export const UPLOAD_PATH = "/upload";

/**
 * Upload and Spark run on demo documents and scripted answers until their own
 * stories connect them (P-18 for uploads, P-17 for the AI gateway). Like the
 * component gallery, they show in a demo session and in development, and a
 * real deployment does not have them.
 */
export function useDemoParts(): boolean {
  const demo = useSessionStore((state) => state.session?.demo ?? false);
  return import.meta.env.DEV || demo;
}

/** Whether this session is shown a way to the upload page: only a role that may upload. */
export function useUploadEntry(): boolean {
  const session = useSessionStore((state) => state.session);
  return useDemoParts() && hasPermission(session, "documents.upload");
}
