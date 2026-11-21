import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/components/kit/env";

/** Whether the person asked for less motion, kept current if they change it. */
export function useReducedPreference(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(query.matches);
    };
    query.addEventListener("change", update);
    return () => {
      query.removeEventListener("change", update);
    };
  }, []);
  return reduced;
}
