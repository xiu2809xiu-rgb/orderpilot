import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./overlays/popover";
import { useSparkPanel } from "./sparkPanel";

/** Help: the keys that work on every page, in a small panel beside the row. */
export function PanelHelp({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const spark = useSparkPanel();
  const keys: { keys: string; does: string }[] = [
    { keys: t("palette.keys"), does: t("shell.help.palette") },
    { keys: t("shell.help.keysSearch"), does: t("shell.help.search") },
    { keys: t("shell.help.keysNew"), does: t("shell.help.new") },
    ...(spark.available
      ? [{ keys: t("shell.help.keysSpark"), does: t("shell.help.spark") }]
      : []),
    { keys: t("shell.help.keysClose"), does: t("shell.help.close") },
  ];
  return (
    <Popover>
      <PopoverTrigger className="dx-entry">
        <CircleHelp className="size-[18px] shrink-0" aria-hidden="true" />
        <span className={cn("min-w-0 truncate", collapsed && "sr-only")}>
          {t("shell.help.label")}
        </span>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-80">
        <h2 className="fs-14 mb-2 font-semibold">{t("shell.help.title")}</h2>
        <dl className="fs-14 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
          {keys.map((row) => (
            <div key={row.does} className="contents">
              <dt>
                <kbd className="dx-kbd">{row.keys}</kbd>
              </dt>
              <dd>{row.does}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
