import { useEffect, useState } from "react";

/**
 * The poster of the hero video, once it is known to load: a missing file
 * (the team adds it later) simply leaves it out, with nothing shown or thrown.
 * It is tried as an image, because a plain request for a missing file can
 * come back as the app's own page.
 */
export function usePoster(src: string): string | null {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setOk(true);
    };
    image.onerror = () => {
      setOk(false);
    };
    image.src = src;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);
  return ok ? src : null;
}
