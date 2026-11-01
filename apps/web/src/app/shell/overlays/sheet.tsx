import type { ComponentProps } from "react";
import type * as Ui from "@/components/ui/sheet";
import { deferredModule } from "@/lib/deferred";
import {
  DeferredRoot,
  DeferredTrigger,
  deferredPart,
  type TriggerProps,
} from "./deferred";

// The shell's sheet (the menu on a narrow screen), with the same names and
// props as "@/components/ui/sheet", which loads after the first paint.
export const sheetModule = deferredModule(
  () => import("@/components/ui/sheet"),
);

export function Sheet(props: ComponentProps<typeof Ui.Sheet>) {
  return (
    <DeferredRoot
      module={sheetModule}
      {...props}
      render={(ui, open) => <ui.Sheet {...props} {...open} />}
    />
  );
}

export function SheetTrigger(props: TriggerProps) {
  return (
    <DeferredTrigger
      module={sheetModule}
      popup="dialog"
      slot="sheet-trigger"
      {...props}
      render={(ui, trigger) => <ui.SheetTrigger {...trigger} />}
    />
  );
}

export const SheetContent = deferredPart(sheetModule, (ui) => ui.SheetContent);
export const SheetHeader = deferredPart(sheetModule, (ui) => ui.SheetHeader);
export const SheetFooter = deferredPart(sheetModule, (ui) => ui.SheetFooter);
export const SheetTitle = deferredPart(sheetModule, (ui) => ui.SheetTitle);
export const SheetDescription = deferredPart(
  sheetModule,
  (ui) => ui.SheetDescription,
);
export const SheetClose = deferredPart(sheetModule, (ui) => ui.SheetClose);
