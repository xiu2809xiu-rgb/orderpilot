import { Dialog } from "radix-ui";
import { useTranslation } from "react-i18next";
import { PromptBar } from "@/components/kit/PromptBar";
import type { SparkPanelProps } from "../screens";
import { useHomeAccess } from "../screens/home/homeAccess";
import { SparkEmpty } from "./SparkEmpty";
import { SparkHead } from "./SparkHead";
import { SparkThread } from "./SparkThread";
import { classify, useSparkChat } from "./useSparkChat";
import "./spark.css";

const INPUT_ID = "spark-input";

/**
 * Spark: the assistant panel, opened from the top bar or with Ctrl and a full
 * stop, over any screen. It is not modal: the page behind stays readable and
 * usable, and Escape or the close button puts the panel away. The orb heads
 * it; the questions and answers are scripted, and the panel says so under the
 * input. Full height, and full width on a phone.
 */
export default function SparkPanel({ open, onOpenChange }: SparkPanelProps) {
  const { t } = useTranslation("directions-spark");
  const mayReadSales = useHomeAccess().measures;
  const chat = useSparkChat();
  const empty = chat.turns.length === 0;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          className="spark-panel dx-panel-strong"
          // The page stays usable beside the panel: a click on it does not close Spark.
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(INPUT_ID)?.focus();
          }}
        >
          <SparkHead
            compact={!empty}
            state={chat.busy ? "thinking" : "idle"}
            onNew={chat.reset}
            onClose={() => {
              onOpenChange(false);
            }}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {empty ? (
              <SparkEmpty mayReadSales={mayReadSales} onAsk={chat.send} />
            ) : (
              <SparkThread
                turns={chat.turns}
                mayReadSales={mayReadSales}
                onFinish={chat.finish}
                onAsk={chat.send}
              />
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 pt-3 pb-4">
            <PromptBar
              inputId={INPUT_ID}
              label={t("input.label")}
              placeholder={t("input.placeholder")}
              help={t("input.help")}
              sendLabel={t("input.send")}
              stopLabel={t("input.stop")}
              busy={chat.busy}
              onStop={chat.stop}
              onSend={(text) => {
                chat.send(text, classify(text, mayReadSales));
              }}
            />
            <p className="fs-12 text-muted-foreground">{t("note")}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
