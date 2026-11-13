import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PanelAction } from "./PanelAction";

/** Help: the keys that work in the preview, in a small panel beside the row. */
export function PanelHelp({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation("directions");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <PanelAction
          icon={CircleHelp}
          label={t("panel.help")}
          collapsed={collapsed}
        />
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-72">
        <h2 className="fs-14 mb-2 font-semibold">{t("help.title")}</h2>
        <dl className="fs-14 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
          <dt>
            <kbd className="dx-kbd">{t("help.keysSearch")}</kbd>
          </dt>
          <dd>{t("help.search")}</dd>
          <dt>
            <kbd className="dx-kbd">{t("help.keysClose")}</kbd>
          </dt>
          <dd>{t("help.close")}</dd>
        </dl>
      </PopoverContent>
    </Popover>
  );
}
