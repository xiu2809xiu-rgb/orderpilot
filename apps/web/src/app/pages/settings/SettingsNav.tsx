import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Session } from "@orderpilot/shared";
import { visibleSections, type SectionId } from "./sections";
import "./settings.css";

const GROUPS = ["you", "app"] as const;

/**
 * The list of sections: links down the side of the page, and on a phone one
 * row of pills. Each is a real link to `?section=`, so Back works and a
 * teammate can be sent to one. A group with nothing for the role is not drawn.
 */
export function SettingsNav({
  session,
  current,
}: {
  session: Session | null;
  current: SectionId | null;
}) {
  const { t } = useTranslation("settings");
  const nav = useRef<HTMLElement>(null);
  const sections = visibleSections(session);

  // On a phone the row scrolls inside its box: keep the current pill in view.
  useEffect(() => {
    const link = nav.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    // jsdom has no scrollIntoView.
    if (link && "scrollIntoView" in link) {
      link.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [current]);

  return (
    <nav ref={nav} aria-label={t("nav.label")} className="sx-nav">
      {GROUPS.map((group) => {
        const items = sections.filter((section) => section.group === group);
        if (items.length === 0) return null;
        return (
          <div
            key={group}
            role="group"
            aria-label={t(`nav.groups.${group}`)}
            className="sx-group"
          >
            <p className="sx-group-label" aria-hidden="true">
              {t(`nav.groups.${group}`)}
            </p>
            {items.map(({ id, icon: Icon }) => (
              <Link
                key={id}
                to={`/settings?section=${id}`}
                aria-current={id === current ? "page" : undefined}
                className="sx-link"
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {t(`nav.sections.${id}`)}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
