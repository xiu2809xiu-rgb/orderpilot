// Kit: Magic UI / blur-fade. Licence: MIT. Adapted to OrderPilot's tokens.
import { motion } from "motion/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useOnScreen, useStill } from "./env";

interface BlurFadeProps {
  children: ReactNode;
  className?: string;
  /** Seconds. Stagger a list by passing index * 0.05. */
  delay?: number;
  /** Pixels the content travels. */
  offset?: number;
  /** Pixels of blur it starts with. */
  blur?: number;
}

/**
 * Content that arrives: it fades in, rises a few pixels and sharpens, once,
 * when it first scrolls into view. For show moments (home, empty states), never
 * for a table or a form in use. Under reduced motion it is simply there.
 */
export function BlurFade({
  children,
  className,
  delay = 0,
  offset = 6,
  blur = 6,
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useStill();
  const seen = useOnScreen(ref, { once: true, margin: "-40px" });

  if (still) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={{ opacity: 0, y: offset, filter: `blur(${String(blur)}px)` }}
      animate={
        seen
          ? { opacity: 1, y: 0, filter: "blur(0px)" }
          : { opacity: 0, y: offset, filter: `blur(${String(blur)}px)` }
      }
      transition={{ delay: 0.04 + delay, duration: 0.4, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
