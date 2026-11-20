import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { PromptBar } from "@/components/kit/PromptBar";
import { SPARK_INPUT_ID } from "./sparkIds";

interface SparkPromptProps {
  /** What is typed and not yet sent. The panel keeps it while it is closed. */
  draft: string;
  onDraft: (text: string) => void;
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

/** Sets a field's value the way typing does, so React hears about it. */
function setLikeTyping(field: HTMLTextAreaElement, text: string) {
  // The element's own setter, not the property React watches on the node.
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  );
  descriptor?.set?.call(field, text);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * The input at the foot of the panel. The kit's PromptBar owns its text and
 * is gone when the panel closes, so this keeps the draft for it: what is typed
 * is noted as it is typed, and put back when the panel opens again. The same
 * path clears the field when the draft is emptied from outside (a new
 * conversation). It never touches the bar's code, only the field's events.
 */
export function SparkPrompt({
  draft,
  onDraft,
  busy,
  onSend,
  onStop,
}: SparkPromptProps) {
  const { t } = useTranslation("directions-spark");
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const field = root.current?.querySelector("textarea");
    if (field && field.value !== draft) setLikeTyping(field, draft);
  }, [draft]);
  return (
    // The wrapper only listens to the field's own events; it is not a control.
    <div
      ref={root}
      onInput={(event) => {
        if (event.target instanceof HTMLTextAreaElement) {
          onDraft(event.target.value);
        }
      }}
    >
      <PromptBar
        inputId={SPARK_INPUT_ID}
        label={t("input.label")}
        placeholder={t("input.placeholder")}
        help={t("input.help")}
        sendLabel={t("input.send")}
        stopLabel={t("input.stop")}
        busy={busy}
        onStop={onStop}
        onSend={(text) => {
          onDraft("");
          onSend(text);
        }}
      />
    </div>
  );
}
