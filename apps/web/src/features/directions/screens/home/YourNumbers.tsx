import { useTranslation } from "react-i18next";
import { HomeSection } from "./HomeSection";
import { cuesFor } from "@/features/nav";
import { useSessionStore } from "@/stores/session";
import { CountTile } from "./CountTile";

/**
 * The columns for each number of tiles, chosen from the room the section has
 * (a container query, because the side panel opens and closes) so a row is
 * never left with one tile on its own where another count would balance it:
 * two columns on a phone, with an odd last tile across both, then one row of
 * four or five, or three by two for six. Written out in full so Tailwind finds
 * every class.
 */
const GRIDS: Readonly<Record<number, string>> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 @xl:grid-cols-3 [&>li:last-child:nth-child(odd)]:col-span-2 @xl:[&>li:last-child:nth-child(odd)]:col-span-1",
  4: "grid-cols-2 @3xl:grid-cols-4",
  5: "grid-cols-2 @3xl:grid-cols-5 [&>li:last-child:nth-child(odd)]:col-span-2 @3xl:[&>li:last-child:nth-child(odd)]:col-span-1",
  6: "grid-cols-2 @xl:grid-cols-3 @6xl:grid-cols-6",
};
const MANY = "grid-cols-2 @xl:grid-cols-3 @4xl:grid-cols-4";

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
    <HomeSection title={t("measures.title")}>
      <div className="@container">
        <ul className={`grid gap-3 ${GRIDS[cues.length] ?? MANY}`}>
          {cues.map(({ feature, cue }) => (
            <li key={`${feature.id}.${cue.id}`} className="min-w-0">
              <CountTile cue={cue} />
            </li>
          ))}
        </ul>
      </div>
    </HomeSection>
  );
}
