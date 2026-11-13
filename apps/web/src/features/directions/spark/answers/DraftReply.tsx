import { Check, Copy } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "../../kit/Frame";

/** Not every context has a clipboard: an insecure page does not. */
function readClipboard(): Clipboard | undefined {
  return navigator.clipboard;
}

interface DraftReplyProps {
  description: string;
  part: string;
  available: string;
}

/**
 * The card under a stock answer: a reply to the customer that Spark has
 * drafted. Both the subject and the message are fields a person edits; Copy puts
 * the text on the clipboard. Spark never sends: the card says so, and there is
 * no send button, because a person sends from their own mail.
 */
export function DraftReply({ description, part, available }: DraftReplyProps) {
  const { t } = useTranslation("directions-spark");
  const subjectId = useId();
  const bodyId = useId();
  const [subject, setSubject] = useState(() =>
    t("stock.draft.subject", { description }),
  );
  const [body, setBody] = useState(() =>
    t("stock.draft.body", { description, part, available }),
  );
  const [copied, setCopied] = useState(false);
  const reset = useRef<number | null>(null);

  const copy = () => {
    void readClipboard()
      ?.writeText(`${subject}\n\n${body}`)
      .then(() => {
        setCopied(true);
        if (reset.current !== null) window.clearTimeout(reset.current);
        reset.current = window.setTimeout(() => {
          setCopied(false);
        }, 2000);
      })
      .catch(() => {
        setCopied(false);
      });
  };

  return (
    <Frame>
      <FrameHeader>
        <FrameTitle>{t("stock.draft.title")}</FrameTitle>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={subjectId} className="fs-14 font-medium">
            {t("stock.draft.subjectLabel")}
          </label>
          <Input
            id={subjectId}
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
            }}
            className="fs-14"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={bodyId} className="fs-14 font-medium">
            {t("stock.draft.bodyLabel")}
          </label>
          <Textarea
            id={bodyId}
            value={body}
            rows={7}
            onChange={(event) => {
              setBody(event.target.value);
            }}
            className="fs-14 min-h-40"
          />
        </div>
        <p className="fs-12 text-muted-foreground">{t("stock.draft.note")}</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={copy}
            className="pointer-coarse:h-11"
          >
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {t("stock.draft.copy")}
          </Button>
          <span role="status" className="fs-14 text-muted-foreground">
            {copied ? t("stock.draft.copied") : ""}
          </span>
        </div>
      </FramePanel>
    </Frame>
  );
}
