import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useIsDark } from "../frame/useIsDark";
import type { Tokens } from "../tokens/contrast";

/**
 * The live value of each named token, read from the page, so a swatch and its
 * contrast always describe what is on screen. It reads in a passive effect:
 * that runs after the frame has put the direction on the document element.
 */
export function useTokens(names: readonly string[]): Tokens {
  const { direction } = useParams();
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
  }, [direction, dark, key]);
  return tokens;
}
