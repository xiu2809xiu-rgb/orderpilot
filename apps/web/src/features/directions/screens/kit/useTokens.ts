import { useEffect, useState } from "react";
import { useIsDark } from "@/lib/useIsDark";
import type { Tokens } from "@/styles/contrast";

/**
 * The live value of each named token, read from the page, so a swatch and its
 * contrast always describe what is on screen. It reads in a passive effect:
 * that runs after the page has settled on its scheme.
 */
export function useTokens(names: readonly string[]): Tokens {
  const dark = useIsDark();
  const [tokens, setTokens] = useState<Tokens>({});
  const key = names.join(",");
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const next: Tokens = {};
    for (const name of key.split(",")) {
      next[name] = style.getPropertyValue(`--${name}`).trim();
    }
    setTokens(next);
  }, [dark, key]);
  return tokens;
}
