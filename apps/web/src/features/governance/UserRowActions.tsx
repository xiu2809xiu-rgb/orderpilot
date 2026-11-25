import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { UsersList200DataItem } from "@/lib/api/generated/model";
import { UserHistoryDialog } from "./UserHistoryDialog";

/**
 * A user's row actions: their history, and Disable or Enable for someone who
 * manages users. Your own row has no Disable (#276): the server refuses it,
 * since someone else has to lock an administrator out, so it is not offered.
 */
export function UserRowActions({
  user,
  canManage,
  self,
  busy,
  onToggle,
}: {
  user: UsersList200DataItem;
  canManage: boolean;
  /** True on the signed-in person's own row. */
  self: boolean;
  busy: boolean;
  onToggle: (user: UsersList200DataItem) => void;
}) {
  const { t } = useTranslation("governance");
  return (
    <div className="flex items-center justify-end gap-1">
      <UserHistoryDialog userId={user.id} name={user.displayName} />
      {canManage && !self ? (
        <Button
          variant="outline"
          size="xs"
          aria-disabled={busy}
          className="pointer-coarse:h-11 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          aria-label={t(
            user.disabled ? "users.enableFor" : "users.disableFor",
            {
              name: user.displayName,
            },
          )}
          onClick={() => {
            onToggle(user);
          }}
        >
          {user.disabled ? t("users.enable") : t("users.disable")}
        </Button>
      ) : null}
    </div>
  );
}
