import { cn } from "@/lib/utils";

interface SkeletonProps extends React.ComponentProps<"div"> {
  /**
   * A table or a list: the block stays a still grey block. Page and card
   * skeletons shimmer (the `dx-shimmer` band in styles/motion.css), but a work
   * screen is never animated while it is in use. `animate-none` is only a marker
   * of a still block: it stops nothing, because the shimmer is a pseudo-element.
   * What keeps a block still is that it has no `dx-shimmer` class.
   */
  still?: boolean;
}

function Skeleton({ className, still = false, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-accent",
        still ? "animate-none" : "dx-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
