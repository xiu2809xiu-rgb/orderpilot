import { useTranslation } from "react-i18next";
import { ClassificationBadge, MaskedValue } from "@/components/common";
import type { AuditViewerGet200Data } from "@/lib/api/generated/model";

type Change = AuditViewerGet200Data["changes"][number];

function Value({ change, value }: { change: Change; value: string | null }) {
  if (change.masked) {
    return <MaskedValue masked reason={change.reason ?? "role"} />;
  }
  return <span className="font-mono text-sm break-all">{value ?? "-"}</span>;
}

/**
 * An event's changes after the server has masked them. A hidden value is not
 * in the data at all: this only draws the reason the server sent.
 */
export function ChangeList({ changes }: { changes: readonly Change[] }) {
  const { t } = useTranslation("audit");
  if (changes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("detail.noChanges")}</p>
    );
  }
  return (
    <dl className="divide-y rounded-md border">
      {changes.map((change) => (
        <div
          key={change.field}
          className="grid grid-cols-1 gap-1 p-s2 sm:grid-cols-[10rem_1fr]"
        >
          <dt className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="font-mono">{change.field}</span>
            <ClassificationBadge level={change.classification} />
          </dt>
          <dd className="space-y-1">
            {change.change ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("detail.before")}
                  </span>
                  <Value change={change} value={change.before} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("detail.after")}
                  </span>
                  <Value change={change} value={change.after} />
                </div>
              </>
            ) : (
              <Value change={change} value={change.after} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
