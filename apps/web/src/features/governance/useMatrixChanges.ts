import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import {
  getMatrixReadQueryKey,
  matrixCopy,
  matrixSetDataScope,
  matrixSetPermission,
} from "@/lib/api/generated/endpoints/governance/governance";
import type { MatrixCopyBody } from "@/lib/api/generated/model";

type Role = MatrixCopyBody["fromRole"];
type Permission = Parameters<typeof matrixSetPermission>[1];
type Scope = Parameters<typeof matrixSetDataScope>[1]["dataScope"];

/** The changes the matrix screen can make, each ending with a toast. */
export function useMatrixChanges() {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getMatrixReadQueryKey() });

  const toggle = useMutation({
    mutationFn: (v: { role: Role; permission: Permission; granted: boolean }) =>
      matrixSetPermission(v.role, v.permission, { granted: v.granted }),
    onSettled: refresh,
  });
  const scope = useMutation({
    mutationFn: (v: { role: Role; dataScope: Scope }) =>
      matrixSetDataScope(v.role, { dataScope: v.dataScope }),
    onSettled: refresh,
  });
  const copy = useMutation({
    mutationFn: (body: MatrixCopyBody) => matrixCopy(body),
    // No Undo: the API keeps no snapshot of the target role's old rows, so a
    // faithful reversal is not possible. The audit trail holds the change.
    onSuccess: (_data, body) =>
      toast.done(
        t("matrix.toast.copied", {
          from: tc(`roles.${body.fromRole}`),
          to: tc(`roles.${body.toRole}`),
        }),
      ),
    onError: () => toast.failed(t("matrix.toast.failed")),
    onSettled: refresh,
  });

  function setPermission(role: Role, permission: Permission, granted: boolean) {
    toggle.mutate(
      { role, permission, granted },
      {
        onSuccess: () =>
          toast.done(
            t(granted ? "matrix.toast.granted" : "matrix.toast.revoked", {
              permission: t(`permissions.${permission}`),
              role: tc(`roles.${role}`),
            }),
            {
              undo: async () => {
                await matrixSetPermission(role, permission, {
                  granted: !granted,
                });
                await refresh();
              },
            },
          ),
        onError: () => toast.failed(t("matrix.toast.failed")),
      },
    );
  }

  function setDataScope(role: Role, dataScope: Scope, before?: Scope) {
    scope.mutate(
      { role, dataScope },
      {
        onSuccess: () =>
          toast.done(
            t("matrix.toast.scope", {
              role: tc(`roles.${role}`),
              scope: t(`matrix.scopes.${dataScope}`),
            }),
            before
              ? {
                  undo: async () => {
                    await matrixSetDataScope(role, { dataScope: before });
                    await refresh();
                  },
                }
              : {},
          ),
        onError: () => toast.failed(t("matrix.toast.failed")),
      },
    );
  }

  return {
    busy: toggle.isPending || scope.isPending || copy.isPending,
    failure: toggle.error ?? scope.error ?? copy.error,
    setPermission,
    setDataScope,
    copyRole: (body: MatrixCopyBody) => copy.mutateAsync(body),
  };
}
