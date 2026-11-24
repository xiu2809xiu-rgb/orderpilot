import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import { ApiError } from "@/lib/api/errors";
import {
  getUsersListQueryKey,
  usersDisable,
  usersEnable,
} from "@/lib/api/generated/endpoints/users/users";
import type { UsersList200DataItem } from "@/lib/api/generated/model";

/**
 * Disabling or enabling a user, with the toast that says how it went. A
 * refused change says the server's own reason and its trace ID (#276): the
 * server knows why, and a person can quote the trace. An access refusal is
 * also drawn above the table by the tab.
 */
export function useUserToggle() {
  const { t } = useTranslation("governance");
  const queryClient = useQueryClient();
  const reload = () =>
    queryClient.invalidateQueries({ queryKey: getUsersListQueryKey() });
  const change = useMutation({
    mutationFn: (v: { id: string; disable: boolean }) =>
      v.disable ? usersDisable(v.id) : usersEnable(v.id),
    onSettled: reload,
  });

  function toggle(user: UsersList200DataItem) {
    // aria-disabled, not disabled, on the button: this keeps a second press out.
    if (change.isPending) return;
    const disable = !user.disabled;
    change.mutate(
      { id: user.id, disable },
      {
        onSuccess: () =>
          toast.done(
            t(disable ? "users.toast.disabled" : "users.toast.enabled", {
              name: user.displayName,
            }),
            {
              undo: async () => {
                await (disable ? usersEnable(user.id) : usersDisable(user.id));
                await reload();
              },
            },
          ),
        onError: (error) =>
          toast.failed(
            t("users.toast.failed"),
            error instanceof ApiError
              ? {
                  description: t("users.toast.reason", {
                    reason: error.message,
                    traceId: error.traceId,
                  }),
                }
              : {},
          ),
      },
    );
  }

  return { change, toggle };
}
