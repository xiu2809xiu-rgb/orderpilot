import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  CopyButton,
  ErrorPanel,
  LoadingState,
  StatusBadge,
} from "@/components/common";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuditViewerGet } from "@/lib/api/generated/endpoints/audit/audit";
import { ChangeList } from "./ChangeList";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-all">{children}</dd>
    </div>
  );
}

function Hash({ value, what }: { value: string | null; what: string }) {
  const { t } = useTranslation("audit");
  if (value === null) {
    return (
      <span className="text-muted-foreground">{t("detail.firstEvent")}</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <code className="font-mono text-xs">{value}</code>
      <CopyButton value={value} what={what} />
    </span>
  );
}

const LINK = "text-primary underline-offset-4 hover:underline";

/** One event in full: who, when, from where, what changed (masked) and its place in the chain. */
export function EventDetailSheet({
  eventId,
  onClose,
}: {
  eventId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("audit");
  const { t: tc } = useTranslation();
  const event = useAuditViewerGet(eventId ?? "", {
    query: { enabled: eventId !== null },
  });
  const data = eventId === null ? undefined : event.data?.data;
  const record = new URLSearchParams();
  if (data) {
    record.set("entity", data.entityType);
    record.set("id", data.entityId);
  }
  const actor = new URLSearchParams();
  if (data?.actorUserId) actor.set("actor", data.actorUserId);

  return (
    <Sheet
      open={eventId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {t("detail.title", { sequence: data?.sequence ?? "" })}
          </SheetTitle>
          <SheetDescription>{t("detail.description")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-s3 px-s3 pb-s3">
          {eventId !== null && event.isPending ? (
            <LoadingState lines={5} />
          ) : null}
          {eventId !== null && event.isError ? (
            <ErrorPanel
              error={event.error}
              onRetry={() => void event.refetch()}
            />
          ) : null}
          {data ? (
            <>
              <p className="text-base">{data.summary}</p>
              <dl className="grid grid-cols-1 gap-s2 sm:grid-cols-2">
                <Field label={t("detail.actor")}>
                  {data.actorName}
                  {data.actorRole ? ` (${tc(`roles.${data.actorRole}`)})` : ""}
                </Field>
                <Field label={t("detail.time")}>
                  <time dateTime={data.occurredAt}>
                    {new Date(data.occurredAt).toLocaleString()}
                  </time>
                </Field>
                <Field label={t("detail.action")}>
                  <code className="font-mono text-xs">{data.action}</code>{" "}
                  {data.refusal ? (
                    <StatusBadge tone="warning">
                      {t("table.refused")}
                    </StatusBadge>
                  ) : null}
                </Field>
                <Field label={t("detail.record")}>
                  <span className="font-mono text-xs">
                    {data.entityType} {data.entityId}
                  </span>
                </Field>
                <Field label={t("detail.ip")}>
                  {data.ip ?? t("detail.noIp")}
                </Field>
                <Field label={t("detail.trace")}>
                  <code className="font-mono text-xs">{data.traceId}</code>
                </Field>
              </dl>
              <section className="space-y-s1">
                <h3 className="text-sm font-medium">{t("detail.changes")}</h3>
                <ChangeList changes={data.changes} />
              </section>
              <section className="space-y-s1">
                <h3 className="text-sm font-medium">{t("detail.hashes")}</h3>
                <dl className="space-y-s1">
                  <Field label={t("detail.hash")}>
                    <Hash value={data.hash} what={t("detail.hash")} />
                  </Field>
                  <Field label={t("detail.prevHash")}>
                    <Hash value={data.prevHash} what={t("detail.prevHash")} />
                  </Field>
                </dl>
              </section>
              <nav className="flex flex-wrap gap-s2 text-sm">
                <Link
                  className={LINK}
                  to={`/audit?${record.toString()}`}
                  onClick={onClose}
                >
                  {t("detail.seeRecord")}
                </Link>
                {data.actorUserId ? (
                  <Link
                    className={LINK}
                    to={`/audit?${actor.toString()}`}
                    onClick={onClose}
                  >
                    {t("detail.seeActor")}
                  </Link>
                ) : null}
              </nav>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
