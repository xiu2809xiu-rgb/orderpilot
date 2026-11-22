import { useSearchParams } from "react-router";
import { ACCOUNT_SECTION, SECTIONS, type SectionDef } from "./sections";

/**
 * The section the address asks for (`?section=appearance`). A missing or
 * unknown value is Account. Whether the role may see it is the caller's
 * question, so that a stale link can say so rather than land somewhere else.
 */
export function useSettingsSection(): SectionDef {
  const [params] = useSearchParams();
  const asked = params.get("section");
  return SECTIONS.find((section) => section.id === asked) ?? ACCOUNT_SECTION;
}
