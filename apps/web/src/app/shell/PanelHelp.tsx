import { CircleHelp } from "lucide-react";
import { useEffect, useId } from "react";
import { useTranslation } from "react-i18next";
import { prefetch, useDeferredModule, whenIdle } from "@/lib/deferred";
import { cn } from "@/lib/utils";
import { helpWordsModule } from "./helpWordsModule";
import { Popover, PopoverContent, PopoverTrigger } from "./overlays/popover";
import { useSparkPanel } from "./sparkPanel";

/** Help: the keys that work on every page, in a small panel beside the row. */
export function PanelHelp({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const spark = useSparkPanel();
  const wordsId = useId();
  const words = useDeferredModule(helpWordsModule);
  // The glossary is a chunk of its own, fetched once the first paint is done.
  useEffect(
    () =>
      whenIdle(() => {
        prefetch(helpWordsModule);
      }),
    [],
  );
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
      {/* Nine words in two columns fit a 768 px screen; a shorter one scrolls the panel rather than cut it off. */}
      <PopoverContent
        side="right"
        align="end"
        aria-label={t("shell.help.label")}
        className="max-h-(--radix-popover-content-available-height) w-[36rem] max-w-[calc(100vw-2rem)] overflow-y-auto"
      >
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
        {words ? <words.HelpWords headingId={wordsId} /> : null}
      </PopoverContent>
    </Popover>
  );
}
