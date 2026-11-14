import "./controls.css";

/**
 * The look of every text control, in one string so that input, textarea and
 * select trigger cannot drift apart. The states, in the order a person meets
 * them: rest, hover (the edge warms), focus (the glowing ring), read-only
 * (dashed and tinted, shadow-less), disabled (dimmed), invalid (red edge and a
 * ring, with the message under the field). Hover is written first and invalid
 * last so that an invalid field stays red under the pointer.
 */
export const CONTROL_SKIN = [
  "border border-input bg-(--control-bg) text-foreground shadow-none outline-none",
  "transition-[border-color,box-shadow] duration-150",
  "placeholder:text-muted-foreground hover:border-ring/70",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35",
  "read-only:border-dashed read-only:bg-(--control-readonly-bg) read-only:hover:border-input",
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input",
  "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:hover:border-destructive dark:aria-invalid:ring-destructive/40",
].join(" ");
