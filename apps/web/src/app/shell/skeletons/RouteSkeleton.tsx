import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { routeKindOf, type RouteKind } from "../routeKind";
import { FormShape } from "./FormShape";
import { HomeShape } from "./HomeShape";
import { ListShape } from "./ListShape";
import { RecordShape } from "./RecordShape";
import { SettingsShape } from "./SettingsShape";

const SHAPES: Record<RouteKind, ComponentType> = {
  home: HomeShape,
  list: ListShape,
  record: RecordShape,
  form: FormShape,
  settings: SettingsShape,
};

/**
 * What the page region shows while a page's code loads: the shape the page
 * will have, chosen from the address alone so that none of the page's code is
 * needed. Both the shape and the thin line wait before they show (shell.css),
 * so a chunk that arrives at once never flashes a skeleton.
 */
export function RouteSkeleton() {
  const { t } = useTranslation();
  const Shape = SHAPES[routeKindOf(useLocation().pathname)];
  return (
    <div role="status" className="dx-skeleton">
      <span className="dx-progress" aria-hidden="true">
        <i />
      </span>
      <span className="sr-only">{t("shell.loading")}</span>
      <Shape />
    </div>
  );
}
