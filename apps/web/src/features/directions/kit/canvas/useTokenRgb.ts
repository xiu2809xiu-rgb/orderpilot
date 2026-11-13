import { useEffect, useState } from "react";
import { parseColor } from "../../tokens/contrast";

type Rgb = readonly [number, number, number];

const FALLBACK: Rgb = [0.5, 0.5, 0.5];

function read(names: readonly string[]): Rgb[] {
  const style = getComputedStyle(document.documentElement);
  return names.map((name) => {
    try {
      const { r, g, b } = parseColor(style.getPropertyValue(name).trim());
      return [r / 255, g / 255, b / 255] as const;
    } catch {
      return FALLBACK;
    }
  });
}

/**
 * The colours of the named tokens as 0 to 1 triples for a shader, read from the
 * page and read again whenever the direction or the scheme changes (both are
 * attributes of the root element). Where a token is missing (a test) it is
 * mid grey, so a canvas never throws over a colour.
 */
export function useTokenRgb(names: readonly string[]): Rgb[] {
  const key = names.join(",");
  const [colours, setColours] = useState<Rgb[]>(() =>
    names.map(() => FALLBACK),
  );
  useEffect(() => {
    const list = key.split(",");
    const update = () => {
      setColours(read(list));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-direction"],
    });
    return () => {
      observer.disconnect();
    };
  }, [key]);
  return colours;
}
