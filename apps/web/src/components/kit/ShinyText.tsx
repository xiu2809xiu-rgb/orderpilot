// Kit: Magic UI / animated-shiny-text. Licence: MIT. Adapted to OrderPilot's tokens.
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import "./kit.css";

/**
 * Text with a soft highlight that passes along it. It says "working": Spark's
 * "Reading the document" line, a streaming answer's first words. Under
 * reduced motion it is plain muted text.
 */
export function ShinyText({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "kit-shiny-text inline-block text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
