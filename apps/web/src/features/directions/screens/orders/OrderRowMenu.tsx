import { Copy, Ellipsis, ExternalLink, PanelRightOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The menu at the end of a row: open the order, look at it in the side peek,
 * or copy its number. Each acts on this row only, whatever is ticked. Quick
 * look is how a keyboard reaches the peek, because a click on the row is a
 * mouse shortcut for it.
 */
export function OrderRowMenu({
  orderNo,
  href,
  onPeek,
}: {
  orderNo: string;
  href: string;
  onPeek: () => void;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="pointer-coarse:size-11"
          aria-label={t("rowMenu.open", { order: orderNo })}
          data-peek-opener={orderNo}
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem asChild className="pointer-coarse:min-h-11">
          <Link to={href}>
            <ExternalLink aria-hidden="true" />
            {t("rowMenu.openOrder")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="pointer-coarse:min-h-11" onSelect={onPeek}>
          <PanelRightOpen aria-hidden="true" />
          {t("rowMenu.peek")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="pointer-coarse:min-h-11"
          onSelect={() => {
            void navigator.clipboard
              .writeText(orderNo)
              .then(() => {
                toast.done(t("rowMenu.copied", { order: orderNo }));
              })
              .catch(() => {
                toast.failed(t("rowMenu.copyFailed"));
              });
          }}
        >
          <Copy aria-hidden="true" />
          {t("rowMenu.copy")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
