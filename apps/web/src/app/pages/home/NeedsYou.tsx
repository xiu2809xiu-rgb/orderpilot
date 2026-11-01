import { INBOX_ROLES, type Session } from "@orderpilot/shared";
import { OverdueOrders } from "./OverdueOrders";
import { RefusedActions } from "./RefusedActions";
import { TaskQueue } from "./TaskQueue";
import { WaitingForSpectra } from "./WaitingForSpectra";

/** What is waiting for this person. The three roles with no inbox get their own list. */
export function NeedsYou({ session }: { session: Session }) {
  const { role } = session.user;
  if (INBOX_ROLES.some((inbox) => inbox === role)) {
    return <TaskQueue touch={role === "WAREHOUSE"} />;
  }
  if (role === "MANAGEMENT") return <OverdueOrders />;
  if (role === "AUDITOR") return <RefusedActions />;
  return <WaitingForSpectra />;
}
