import { useState } from "react";
import { useSessionStore } from "@/stores/session";

/** Who was signed in when a form was first shown. */
export function useMountViewer(): string | undefined {
  const [viewerId] = useState(
    () => useSessionStore.getState().session?.user.id,
  );
  return viewerId;
}

/**
 * True once someone else has signed in over a form, as the session-ended
 * dialog allows. What the form holds then is the first person's: their values,
 * and a record read under their permissions.
 */
export function useViewerChanged(): boolean {
  const mountViewer = useMountViewer();
  const viewerId = useSessionStore((state) => state.session?.user.id);
  return viewerId !== undefined && viewerId !== mountViewer;
}

/** The same question, asked at the moment of a save. */
export function isSameViewer(mountViewer: string | undefined): boolean {
  return useSessionStore.getState().session?.user.id === mountViewer;
}
