import { useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RoleSwitchDialogProps {
  open: boolean;
  /** Stay as the same person: also what Escape does. */
  onStay: () => void;
  onSwitch: () => void;
  /**
   * Where focus goes on every close: the button that opened the menu. The
   * dialog cannot remember document.activeElement for this, because from the
   * second ask on that is a menu item that is gone by the time it closes.
   */
  returnFocusTo: RefObject<HTMLElement | null>;
}

/**
 * Another role is another person's session, so what a form or a review holds
 * is lost with the switch. The same question as signing out, in its own words.
 * Staying takes focus, so Enter never throws work away.
 */
export function RoleSwitchDialog({
  open,
  onStay,
  onSwitch,
  returnFocusTo,
}: RoleSwitchDialogProps) {
  const { t } = useTranslation();
  const stay = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
    >
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          stay.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("demo.switchAsk.title")}</DialogTitle>
          <DialogDescription>{t("demo.switchAsk.body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onSwitch}>
            {t("demo.switchAsk.switch")}
          </Button>
          <Button ref={stay} onClick={onStay}>
            {t("demo.switchAsk.stay")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
