import type { ComponentProps } from "react";
import type * as Ui from "@/components/ui/dropdown-menu";
import { deferredModule } from "@/lib/deferred";
import {
  DeferredRoot,
  DeferredTrigger,
  deferredPart,
  type TriggerProps,
} from "./deferred";

// The shell's dropdown menus, with the same names and props as
// "@/components/ui/dropdown-menu", which loads after the first paint.
export const dropdownMenuModule = deferredModule(
  () => import("@/components/ui/dropdown-menu"),
);

export function DropdownMenu(props: ComponentProps<typeof Ui.DropdownMenu>) {
  return (
    <DeferredRoot
      module={dropdownMenuModule}
      {...props}
      render={(ui, open) => <ui.DropdownMenu {...props} {...open} />}
    />
  );
}

export function DropdownMenuTrigger(props: TriggerProps) {
  return (
    <DeferredTrigger
      module={dropdownMenuModule}
      popup="menu"
      slot="dropdown-menu-trigger"
      {...props}
      render={(ui, trigger) => <ui.DropdownMenuTrigger {...trigger} />}
    />
  );
}

export const DropdownMenuContent = deferredPart(
  dropdownMenuModule,
  (ui) => ui.DropdownMenuContent,
);
export const DropdownMenuGroup = deferredPart(
  dropdownMenuModule,
  (ui) => ui.DropdownMenuGroup,
);
export const DropdownMenuLabel = deferredPart(
  dropdownMenuModule,
  (ui) => ui.DropdownMenuLabel,
);
export const DropdownMenuItem = deferredPart(
  dropdownMenuModule,
  (ui) => ui.DropdownMenuItem,
);
export const DropdownMenuRadioGroup = deferredPart(
  dropdownMenuModule,
  (ui) => ui.DropdownMenuRadioGroup,
);
export const DropdownMenuRadioItem = deferredPart(
  dropdownMenuModule,
  (ui) => ui.DropdownMenuRadioItem,
);
export const DropdownMenuSeparator = deferredPart(
  dropdownMenuModule,
  (ui) => ui.DropdownMenuSeparator,
);
