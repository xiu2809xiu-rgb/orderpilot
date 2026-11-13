import { roleSchema } from "@orderpilot/shared";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { PERMISSION_GROUPS, type MatrixFilters } from "./matrixFilter";

const isGroup = (value: string | null): value is string =>
  (PERMISSION_GROUPS as readonly (string | null)[]).includes(value);

/**
 * The matrix's filters, kept in the address bar as the audit log's are, so a
 * view can be shared. A role or group in a link that does not exist counts as
 * no filter, because the address is whatever someone typed.
 */
export function useMatrixFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo<MatrixFilters>(() => {
    const role = roleSchema.safeParse(params.get("role"));
    const group = params.get("group");
    return {
      search: params.get("q") ?? "",
      role: role.success ? role.data : "",
      group: isGroup(group) ? group : "",
    };
  }, [params]);

  const setFilters = (next: MatrixFilters) => {
    setParams(
      (current) => {
        const out = new URLSearchParams(current);
        for (const [name, value] of [
          ["q", next.search],
          ["role", next.role],
          ["group", next.group],
        ] as const) {
          if (value === "") out.delete(name);
          else out.set(name, value);
        }
        return out;
      },
      { replace: true },
    );
  };

  return { filters, setFilters };
}
