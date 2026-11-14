import { Inbox } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PermissionDenied } from "@/components/common";
import { EmptyState } from "@/components/parts/EmptyState";
import { PageHeader } from "@/components/parts/PageHeader";
import { OrderPeek } from "./OrderPeek";
import { OrdersActions } from "./OrdersActions";
import { OrdersWorkspace } from "./OrdersWorkspace";
import "./orders.css";
import { useOrdersWorkspace } from "./useOrdersWorkspace";

/**
 * Orders: one workspace in place of the Orders page and the order tracker.
 * The views run across the top, the filters of both old pages sit under them,
 * and one table holds every order with its journey. A click on a row opens the
 * side peek; the number opens the order. The address carries every choice, so
 * a link from the home screen opens the list already filtered. A role that
 * may not read orders sees the title and the refusal, and nothing to filter.
 */
export default function OrdersScreen() {
  const { t } = useTranslation("directions-orders");
  const { t: tc } = useTranslation("common");
  const w = useOrdersWorkspace();
  const [peekNo, setPeekNo] = useState<string | null>(null);
  const { filtered, status } = w;
  const peekIndex = filtered.findIndex((row) => row.orderNo === peekNo);
  const peeked = peekIndex >= 0 ? (filtered[peekIndex] ?? null) : null;
  const empty = status === "ready" && w.data.rows.length === 0;

  return (
    <div className="od-page">
      <PageHeader
        title={t("title")}
        intro={
          status === "ready"
            ? t("intro", { count: w.data.total, late: w.late })
            : undefined
        }
        actions={status === "forbidden" ? undefined : <OrdersActions />}
      />
      {status === "forbidden" ? (
        <PermissionDenied />
      ) : empty ? (
        <EmptyState
          icon={Inbox}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <OrdersWorkspace w={w} peeked={peekNo} onPeek={setPeekNo} />
      )}
      <OrderPeek
        row={peeked}
        position={peekIndex + 1}
        total={filtered.length}
        roleLabel={(role) => tc(`roles.${role}`)}
        onStep={(delta) => {
          const next = filtered[peekIndex + delta];
          if (next) setPeekNo(next.orderNo);
        }}
        onClose={() => {
          setPeekNo(null);
        }}
      />
    </div>
  );
}
