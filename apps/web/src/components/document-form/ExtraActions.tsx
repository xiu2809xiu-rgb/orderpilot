import { Ellipsis } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSessionStore } from "@/stores/session";
import { documentFormItemsFor } from "./registry";
import type { DocumentTarget } from "./types";

/**
 * The More menu: the actions every document form shares, registered once
 * (`registerDocumentFormItem`). Nothing is drawn while none is registered, so
 * the bar has no empty menu.
 */
export function ExtraActions({ target }: { target: DocumentTarget }) {
  const { t } = useTranslation("document-form");
  const { t: tc } = useTranslation("common");
  const session = useSessionStore((state) => state.session);
  const items = documentFormItemsFor(session);
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-coarse:h-11"
        >
          <Ellipsis aria-hidden="true" />
          {t("bar.more")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {items.map(({ id, label, icon: Icon, run }) => (
          <DropdownMenuItem
            key={id}
            className="pointer-coarse:min-h-11"
            onSelect={() => {
              run(target);
            }}
          >
            <Icon aria-hidden="true" />
            {tc(label)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
