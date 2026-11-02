import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { LinesAnswer, LinesViewer } from "./linesDemo";

const VIEWERS: readonly LinesViewer[] = ["support", "warehouse"];
const ANSWERS: readonly LinesAnswer[] = ["saves", "refuses"];

interface GalleryLinesBarProps {
  viewer: LinesViewer;
  onViewer: (viewer: LinesViewer) => void;
  readOnly: boolean;
  onReadOnly: (readOnly: boolean) => void;
  answer: LinesAnswer;
  onAnswer: (answer: LinesAnswer) => void;
  onMany: () => void;
  onFew: () => void;
}

function pick<T extends string>(
  all: readonly T[],
  value: string,
): T | undefined {
  return all.find((one) => one === value);
}

/** The switches that put the grid in each of its states. */
export function GalleryLinesBar(props: GalleryLinesBarProps) {
  const { t } = useTranslation("gallery");
  return (
    <div className="flex flex-wrap items-center gap-x-s3 gap-y-s1">
      <div className="flex items-center gap-2">
        <Label htmlFor="gallery-lines-viewer" className="text-xs">
          {t("lines.bar.viewer")}
        </Label>
        <Select
          value={props.viewer}
          onValueChange={(value) => {
            const next = pick(VIEWERS, value);
            if (next) props.onViewer(next);
          }}
        >
          <SelectTrigger id="gallery-lines-viewer" size="sm" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEWERS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`lines.bar.viewers.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="gallery-lines-answer" className="text-xs">
          {t("lines.bar.answer")}
        </Label>
        <Select
          value={props.answer}
          onValueChange={(value) => {
            const next = pick(ANSWERS, value);
            if (next) props.onAnswer(next);
          }}
        >
          <SelectTrigger id="gallery-lines-answer" size="sm" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANSWERS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`lines.bar.answers.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="gallery-lines-readonly"
          checked={props.readOnly}
          onCheckedChange={props.onReadOnly}
        />
        <Label htmlFor="gallery-lines-readonly" className="text-xs">
          {t("lines.bar.readOnly")}
        </Label>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={props.onFew}>
        {t("lines.bar.few")}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={props.onMany}>
        {t("lines.bar.many")}
      </Button>
    </div>
  );
}
