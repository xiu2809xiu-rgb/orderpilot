// Kit: React Bits / PromptBar. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import { BorderBeam } from "./BorderBeam";
import "./kit.css";

interface PromptBarProps {
  /** The id of the field, for a caller that moves focus to it. */
  inputId?: string;
  /** The name of the field: always shown, never replaced by the placeholder. */
  label: string;
  placeholder: string;
  /** Spark is working: the border glows and the button becomes Stop. */
  busy?: boolean;
  onSend: (text: string) => void;
  onStop?: () => void;
  sendLabel: string;
  stopLabel: string;
  /** The help line under the field: keys, and what the bar can do. */
  help?: string;
  maxRows?: number;
  className?: string;
}

// The send arrow and the stop square are the same seven points, so one path
// morphs between them.
const ARROW_UP = [
  12, 4.5, 18.5, 11, 14.25, 11, 14.25, 19.5, 9.75, 19.5, 9.75, 11, 5.5, 11,
];
const SQUARE = [12, 6, 18, 6, 18, 12, 18, 18, 6, 18, 6, 12, 6, 6];
const EASE_IN_OUT: [number, number, number, number] = [0.77, 0, 0.175, 1];
const LINE_PX = 22;

function pathAt(from: number[], to: number[], t: number): string {
  let d = "";
  for (let i = 0; i < from.length; i += 2) {
    const x = (from[i] ?? 0) + ((to[i] ?? 0) - (from[i] ?? 0)) * t;
    const y = (from[i + 1] ?? 0) + ((to[i + 1] ?? 0) - (from[i + 1] ?? 0)) * t;
    d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

function SendGlyph({ busy }: { busy: boolean }) {
  const reduce = useReducedMotion();
  const pathRef = useRef<SVGPathElement>(null);
  const t = useMotionValue(busy ? 1 : 0);
  useEffect(() => {
    const target = busy ? 1 : 0;
    if (t.get() === target) return;
    const controls = animate(
      t,
      target,
      reduce ? { duration: 0 } : { duration: 0.24, ease: EASE_IN_OUT },
    );
    return () => {
      controls.stop();
    };
  }, [busy, reduce, t]);
  useMotionValueEvent(t, "change", (value) => {
    pathRef.current?.setAttribute("d", pathAt(ARROW_UP, SQUARE, value));
  });
  return (
    <svg
      className="block size-4"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path ref={pathRef} d={pathAt(ARROW_UP, SQUARE, t.get())} />
    </svg>
  );
}

/**
 * Spark's input: a field that grows with what is typed, a send button that
 * turns into Stop while Spark works, and a border that glows (a light runs
 * round it) while it does. Enter sends, Shift and Enter start a new line. The
 * original's attachment, model and effort menus, dictation and spark particles
 * are left out: Spark's answers here are scripted and have no such choices. A
 * label and a help line are always shown, and nothing is sent while the field
 * is empty.
 */
export function PromptBar({
  inputId,
  label,
  placeholder,
  busy = false,
  onSend,
  onStop,
  sendLabel,
  stopLabel,
  help,
  maxRows = 5,
  className,
}: PromptBarProps) {
  const generated = useId();
  const id = inputId ?? generated;
  const helpId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const canSend = draft.trim().length > 0;

  // Grow with the text, up to maxRows lines, then scroll inside.
  useLayoutEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${String(Math.min(node.scrollHeight, LINE_PX * maxRows))}px`;
  }, [draft, maxRows]);

  const send = () => {
    if (!canSend || busy) return;
    onSend(draft.trim());
    setDraft("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    send();
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="fs-14 font-medium text-foreground">
        {label}
      </label>
      <div
        data-busy={busy}
        className="kit-prompt-bar relative flex items-end gap-2 border border-border bg-card p-2 focus-within:border-ring"
        style={{ borderRadius: "var(--radius-card)" }}
      >
        <textarea
          ref={field}
          id={id}
          rows={1}
          value={draft}
          placeholder={placeholder}
          aria-describedby={help ? helpId : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={onKeyDown}
          className="fs-14 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label={busy ? stopLabel : sendLabel}
          disabled={!busy && !canSend}
          onClick={busy ? onStop : send}
          className="inline-flex size-9 shrink-0 items-center justify-center bg-primary text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 pointer-coarse:size-11"
          style={{ borderRadius: "var(--radius-control)" }}
        >
          <SendGlyph busy={busy} />
        </button>
        {busy ? <BorderBeam size={96} duration={3.2} /> : null}
      </div>
      {help ? (
        <p id={helpId} className="fs-12 text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}
