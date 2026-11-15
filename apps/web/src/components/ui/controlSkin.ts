import "./controls.css";

/**
 * The read-only look belongs to a text box that is read-only. A bare
 * `:read-only` also matches a button and a select trigger, which are never
 * editable, so every dropdown was drawn dashed as if it were locked.
 */
const READ_ONLY = "[&:is(input,textarea):read-only]";

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
  `${READ_ONLY}:border-dashed ${READ_ONLY}:bg-(--control-readonly-bg) ${READ_ONLY}:hover:border-input`,
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input",
  "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:hover:border-destructive dark:aria-invalid:ring-destructive/40",
].join(" ");
