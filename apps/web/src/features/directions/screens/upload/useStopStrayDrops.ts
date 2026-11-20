import { useEffect } from "react";

function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function inDropZone(event: Event): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest("[data-dropzone]") !== null
  );
}

/**
 * While this screen is mounted, a file dropped anywhere but the drop zone is
 * stopped: the browser would otherwise open it and leave the app. The zone
 * keeps its own handling (it takes the file); everywhere else the pointer
 * shows that a drop is not accepted. The listeners sit on the window and are
 * removed on unmount, so no other screen is affected.
 */
export function useStopStrayDrops() {
  useEffect(() => {
    function over(event: DragEvent) {
      if (!carriesFiles(event) || inDropZone(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
    }
    function drop(event: DragEvent) {
      if (!carriesFiles(event) || inDropZone(event)) return;
      event.preventDefault();
    }
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);
}
