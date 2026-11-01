import type { Session } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { cuesFor } from "@/features/nav";
import { HomeTile } from "./HomeTile";

/** The role's counts: one row at desktop, two columns on a phone. */
export function HomeTiles({ session }: { session: Session }) {
  const { t } = useTranslation("home");
  return (
    <section aria-label={t("tiles.label")}>
      <ul className="grid grid-cols-2 gap-s2 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
        {cuesFor(session).map(({ feature, cue }) => (
          <li key={`${feature.id}.${cue.id}`} className="min-w-0">
            <HomeTile cue={cue} />
          </li>
        ))}
      </ul>
    </section>
  );
}
