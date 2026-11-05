import { useState } from "react";
import { GalleryLinesForm } from "./GalleryLinesForm";
import type { LinesViewer } from "./linesDemo";

/**
 * The lines grid as Support uses it, with a switch to see it as a role that
 * may not see prices. The form starts over when the viewer changes, as a
 * different person's form would, so a price typed by one is never held by the
 * other.
 */
export function GalleryLines() {
  const [viewer, setViewer] = useState<LinesViewer>("support");
  return <GalleryLinesForm key={viewer} viewer={viewer} onViewer={setViewer} />;
}
