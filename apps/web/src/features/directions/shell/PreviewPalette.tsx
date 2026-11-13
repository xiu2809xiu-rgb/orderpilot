import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SCREENS, screenPath } from "../screens";

/** Jump to a screen of the preview. It lists only screens that are built. */
export function PreviewPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("directions");
  const navigate = useNavigate();
  const opener = useRef<HTMLElement | null>(null);

  // The dialog has no trigger of its own to return focus to, so remember who
  // had it (the search field or the page) and give it back on close.
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement;
    }
  }, [open]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("bar.paletteTitle")}
      description={t("bar.paletteDescription")}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        const target = opener.current?.isConnected
          ? opener.current
          : document.getElementById("main");
        target?.focus();
      }}
    >
      <CommandInput placeholder={t("bar.palettePlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("bar.paletteEmpty")}</CommandEmpty>
        <CommandGroup heading={t("bar.paletteScreens")}>
          {SCREENS.map(({ id }) => (
            <CommandItem
              key={id}
              value={t(`screens.${id}.title`)}
              onSelect={() => {
                onOpenChange(false);
                void navigate(screenPath(id));
              }}
            >
              {t(`screens.${id}.title`)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
