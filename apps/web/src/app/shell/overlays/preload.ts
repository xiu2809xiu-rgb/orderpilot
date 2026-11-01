import { dropdownMenuModule } from "./dropdown-menu";
import { popoverModule } from "./popover";
import { sheetModule } from "./sheet";

/**
 * Loads every shell overlay now. Tests call it so the shell renders as it
 * does once the browser has prefetched them.
 */
export async function loadShellOverlays(): Promise<void> {
  await Promise.all([
    dropdownMenuModule.load(),
    popoverModule.load(),
    sheetModule.load(),
  ]);
}
