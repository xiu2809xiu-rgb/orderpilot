import { createContext, useContext } from "react";

/**
 * True below the signed-in shell's page region. A fallback that is drawn there
 * (`Splash`, which pages use while their chunk loads) shows the shape of the
 * page that is coming. Outside the shell there is no page region to fill, so
 * the same fallback is the full-window splash.
 */
export const InShellContext = createContext(false);

export function useInShell(): boolean {
  return useContext(InShellContext);
}
