import type { ComponentProps } from "react";
import { Command } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The row highlighted now, by its value. */
  value: string;
  onValueChange: (value: string) => void;
  onCloseAutoFocus: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
  children: React.ReactNode;
}

/**
 * The shared CommandDialog with its list filter switched off. The palette
 * decides what is listed (the server's records, and pages and actions that
 * match by word), and cmdk's fuzzy filter would hide records again or match
 * "kpi" to "Use the dark theme". The highlighted row is controlled so that it
 * can go back to the first one when results arrive late.
 */
export function PaletteDialog({
  open,
  onOpenChange,
  title,
  description,
  value,
  onValueChange,
  onCloseAutoFocus,
  children,
}: PaletteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className="overflow-hidden p-0"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <Command
          shouldFilter={false}
          value={value}
          onValueChange={onValueChange}
          className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}
