import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common";
import { InboxList } from "./InboxList";
import { RolePicker } from "./RolePicker";
import { useInboxRole } from "./useInboxRole";
import { WorkflowNav } from "./WorkflowNav";

/** The task inbox: a role's own, or any role's for the roles that oversee. */
export default function WorkflowsPage() {
  const { t } = useTranslation("workflows");
  const { role, mayPick, setRole } = useInboxRole();
  if (role === undefined) {
    return (
      <EmptyState
        title={t("inbox.noInboxTitle")}
        description={t("inbox.noInboxDescription")}
      />
    );
  }
  return (
    <InboxList
      role={role}
      mayPick={mayPick}
      above={
        <div className="space-y-s3">
          <WorkflowNav />
          {mayPick ? <RolePicker value={role} onChange={setRole} /> : null}
        </div>
      }
    />
  );
}
