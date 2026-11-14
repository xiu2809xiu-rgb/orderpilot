import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";
import { cuesFor } from "@/features/nav";
import { useSessionStore } from "@/stores/session";
import { CountTile } from "./CountTile";

/**
 * The role's own counts, in the role's order (`TILE_ORDER` in features/nav).
 * Each feature declares its tiles, so a role sees only counts of lists it may
 * open, and each tile opens its list. A role with no tile has no section.
 */
export function YourNumbers() {
  const { t } = useTranslation("directions-home");
  const session = useSessionStore((state) => state.session);
  const cues = cuesFor(session);
  if (cues.length === 0) return null;
  return (
    <Section title={t("measures.title")}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        {cues.map(({ feature, cue }) => (
          <li key={`${feature.id}.${cue.id}`} className="min-w-0">
            <CountTile cue={cue} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
