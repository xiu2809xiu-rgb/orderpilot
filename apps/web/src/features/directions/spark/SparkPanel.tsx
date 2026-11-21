import { Dialog } from "radix-ui";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHomeAccess } from "../screens/home/homeAccess";
import { SparkEmpty } from "./SparkEmpty";
import { SparkHead } from "./SparkHead";
import { SparkPrompt } from "./SparkPrompt";
import { SparkThread } from "./SparkThread";
import { SPARK_BUTTON_ID, SPARK_INPUT_ID, SPARK_PANEL_ID } from "./sparkIds";
import { classify, useSparkChat, type SparkKind } from "./useSparkChat";
import { useDockClearance } from "./useDockClearance";
import "./spark.css";

/** The shell owns whether the panel is open (app/shell/sparkPanel.tsx). */
interface SparkPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function focusInput() {
  document.getElementById(SPARK_INPUT_ID)?.focus();
}

/**
 * Radix wraps Tab round inside every dialog, modal or not, so a keyboard user
 * could never reach the page. Spark is not modal, so the key is stopped before
 * Radix hears it and the browser moves on as it would anywhere else.
 */
function letTabLeave(node: HTMLElement | null) {
  if (!node) return;
  const stop = (event: KeyboardEvent) => {
    if (event.key === "Tab") event.stopPropagation();
  };
  node.addEventListener("keydown", stop);
  return () => {
    node.removeEventListener("keydown", stop);
  };
}

/**
 * Spark: the assistant panel, opened from the top bar or with Ctrl and a full
 * stop, over any screen. It is not modal: the page behind stays readable and
 * usable, Tab leaves it, and Escape, the close button or the Spark button put
 * it away and give focus back to that button. The orb heads it; the questions
 * and answers are scripted, and every reply says so. The panel is a column
 * with three parts, the head, the thread (the only part that scrolls) and the
 * input, which stays at the foot however long the conversation grows. Like a
 * window on Windows it can be maximised and restored; it keeps that size, and
 * what was typed and not sent, when it is closed and opened again.
 */
export default function SparkPanel({ open, onOpenChange }: SparkPanelProps) {
  const { t } = useTranslation("directions-spark");
  const mayReadSales = useHomeAccess().measures;
  const { turns, busy, send, finish, stop, reset } = useSparkChat();
  const [maximised, setMaximised] = useState(false);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const empty = turns.length === 0;
  useDockClearance();

  // A question sent from a suggestion ends with its button gone, so focus is
  // put back in the input every time: it stays there while the answer comes.
  const ask = useCallback(
    (question: string, kind: SparkKind) => {
      send(question, kind);
      focusInput();
    },
    [send],
  );
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          id={SPARK_PANEL_ID}
          ref={letTabLeave}
          className="spark-panel dx-panel-strong"
          data-maximised={maximised}
          // The page stays usable beside the panel: a click on it does not close Spark.
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusInput();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(SPARK_BUTTON_ID)?.focus();
          }}
        >
          <SparkHead
            compact={!empty}
            state={busy ? "thinking" : "idle"}
            maximised={maximised}
            onNew={() => {
              reset();
              setDraft("");
              focusInput();
            }}
            onToggleMaximised={() => {
              setMaximised((value) => !value);
            }}
            onClose={() => {
              onOpenChange(false);
            }}
          />
          <div
            ref={scroller}
            className="spark-measure spark-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4"
          >
            {empty ? (
              <SparkEmpty mayReadSales={mayReadSales} onAsk={ask} />
            ) : (
              <SparkThread
                turns={turns}
                mayReadSales={mayReadSales}
                scroller={scroller}
                onFinish={finish}
                onAsk={ask}
              />
            )}
          </div>
          <div className="spark-measure flex shrink-0 flex-col gap-2 border-t border-border px-4 pt-3 pb-4">
            <SparkPrompt
              draft={draft}
              onDraft={setDraft}
              busy={busy}
              onStop={stop}
              onSend={(text) => {
                ask(text, classify(text, mayReadSales));
              }}
            />
            <p className="fs-12 text-muted-foreground">{t("note")}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
