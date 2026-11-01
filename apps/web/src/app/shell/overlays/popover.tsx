import type { ComponentProps } from "react";
import type * as Ui from "@/components/ui/popover";
import { deferredModule } from "@/lib/deferred";
import {
  DeferredRoot,
  DeferredTrigger,
  deferredPart,
  type TriggerProps,
} from "./deferred";

// The shell's popovers, with the same names and props as
// "@/components/ui/popover", which loads after the first paint.
export const popoverModule = deferredModule(
  () => import("@/components/ui/popover"),
);

export function Popover(props: ComponentProps<typeof Ui.Popover>) {
  return (
    <DeferredRoot
      module={popoverModule}
      {...props}
      render={(ui, open) => <ui.Popover {...props} {...open} />}
    />
  );
}

export function PopoverTrigger(props: TriggerProps) {
  return (
    <DeferredTrigger
      module={popoverModule}
      popup="dialog"
      slot="popover-trigger"
      {...props}
      render={(ui, trigger) => <ui.PopoverTrigger {...trigger} />}
    />
  );
}

export const PopoverContent = deferredPart(
  popoverModule,
  (ui) => ui.PopoverContent,
);
export const PopoverHeader = deferredPart(
  popoverModule,
  (ui) => ui.PopoverHeader,
);
export const PopoverTitle = deferredPart(
  popoverModule,
  (ui) => ui.PopoverTitle,
);
export const PopoverDescription = deferredPart(
  popoverModule,
  (ui) => ui.PopoverDescription,
);
