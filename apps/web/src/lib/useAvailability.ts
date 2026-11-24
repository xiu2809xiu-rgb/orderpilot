import {
  PERSON_AVAILABILITY_HOLD_HOURS,
  personAvailabilityRoutes,
  type MyAvailability,
  type PersonAvailability,
} from "@orderpilot/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common/toast";
import type {
  AvailabilityPickerLabels,
  AvailabilityPickerProps,
} from "@/components/kit/availability-picker/types";
import { apiClient } from "@/lib/api/instance";
import { describeError } from "@/lib/errors";
import { useExpiryTimer } from "@/lib/useExpiryTimer";
import { useSessionStore } from "@/stores/session";

interface Answer {
  data: MyAvailability;
}

/** The key carries the person, so one person's value is never drawn for the next. */
export const availabilityKey = (userId: string) =>
  ["availability", "mine", userId] as const;

const HOLD_MS = PERSON_AVAILABILITY_HOLD_HOURS * 3_600_000;

/** What the screen shows at once, before the server answers. The server's answer replaces it. */
function guess(next: PersonAvailability): Answer {
  if (next === "AVAILABLE") {
    return { data: { value: next, setAt: null, expiresAt: null } };
  }
  const now = Date.now();
  return {
    data: {
      value: next,
      setAt: new Date(now).toISOString(),
      expiresAt: new Date(now + HOLD_MS).toISOString(),
    },
  };
}

/** The words of the control, from the common namespace only: the shell must not wait for a lazy one. */
export function useAvailabilityLabels(
  value: PersonAvailability,
): AvailabilityPickerLabels {
  const { t } = useTranslation();
  return useMemo(() => {
    const options: AvailabilityPickerLabels["options"] = {
      AVAILABLE: t("availability.values.AVAILABLE"),
      FOCUSING: t("availability.values.FOCUSING"),
      DO_NOT_DISTURB: t("availability.values.DO_NOT_DISTURB"),
    };
    return {
      trigger: t("availability.trigger", { value: options[value] }),
      menu: t("availability.menu.label"),
      description: t("availability.menu.hint", {
        hours: PERSON_AVAILABILITY_HOLD_HOURS,
      }),
      options,
      saving: t("availability.saving"),
    };
  }, [t, value]);
}

export interface UseAvailability {
  status: "loading" | "error" | "ready";
  error: unknown;
  /** AVAILABLE until ready. */
  value: PersonAvailability;
  setAt: Date | null;
  expiresAt: Date | null;
  saving: boolean;
  /** The last refused change, for the Settings alert. */
  refused: unknown;
  /** This page watched the 12 hours end. */
  fellBack: boolean;
  /** Raised after a successful pick. */
  pulse: number;
  set: (next: PersonAvailability) => void;
  retryLoad: () => void;
  retryLast: () => void;
  controlProps: Pick<
    AvailabilityPickerProps,
    "value" | "onChange" | "busy" | "pulse" | "labels"
  >;
}

interface Context {
  previous: Answer | undefined;
}

/**
 * The signed-in person's own availability: read it, change it, and fall back
 * to Available when the server says the 12 hours are over. It is information
 * for colleagues and changes no rule (ADR 0070). A change shows at once and is
 * put back if the server refuses it.
 */
export function useAvailability(): UseAvailability {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const userId = useSessionStore((state) => state.session?.user.id);
  const key = availabilityKey(userId ?? "nobody");
  const [pulse, setPulse] = useState(0);
  const [fell, setFell] = useState<{ userId: string; on: boolean } | null>(
    null,
  );

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      apiClient.call({ ...personAvailabilityRoutes.mine, signal }),
    enabled: userId !== undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const mine = query.data?.data;
  const value = mine?.value ?? "AVAILABLE";
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  });

  const mutation = useMutation<Answer, unknown, PersonAvailability, Context>({
    mutationFn: (next) =>
      apiClient.call(personAvailabilityRoutes.set, { value: next }),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Answer>(key);
      queryClient.setQueryData(key, guess(next));
      return { previous };
    },
    onError: (error, _next, context) => {
      queryClient.setQueryData(key, context?.previous);
      const { message, traceId } = describeError(error, t);
      toast.failed(t("availability.failed"), {
        description: traceId
          ? `${message} ${t("errors.traceId")}: ${traceId}`
          : message,
      });
    },
    onSuccess: (answer, next, context) => {
      queryClient.setQueryData(key, answer);
      setPulse((count) => count + 1);
      // Undo only from Available: the server stamps the time itself, so
      // undoing any other change would start a fresh 12 hours, not restore the
      // hours that were left.
      const undo =
        next !== "AVAILABLE" && context.previous?.data.value === "AVAILABLE"
          ? () => {
              mutation.mutate("AVAILABLE");
            }
          : undefined;
      toast.done(
        t(`availability.set.${next}`, {
          hours: PERSON_AVAILABILITY_HOLD_HOURS,
        }),
        { undo },
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["availability"] }),
  });

  const ask = useCallback(async () => {
    const before = valueRef.current;
    const answered = await query.refetch();
    const now = answered.data?.data;
    if (before !== "AVAILABLE" && now?.value === "AVAILABLE" && userId) {
      setFell({ userId, on: true });
    }
    return now?.expiresAt ?? null;
  }, [query, userId]);
  useExpiryTimer(mine?.expiresAt ?? null, ask);

  const set = useCallback(
    (next: PersonAvailability) => {
      if (mutation.isPending) return;
      if (next === "AVAILABLE" && valueRef.current === "AVAILABLE") return;
      setFell(null);
      mutation.mutate(next);
    },
    [mutation],
  );

  const labels = useAvailabilityLabels(value);
  const saving = mutation.isPending;
  return {
    status: query.isPending ? "loading" : mine ? "ready" : "error",
    error: query.error,
    value,
    setAt: mine?.setAt ? new Date(mine.setAt) : null,
    expiresAt: mine?.expiresAt ? new Date(mine.expiresAt) : null,
    saving,
    refused: mutation.isError ? mutation.error : null,
    fellBack: fell !== null && fell.userId === userId && fell.on,
    pulse,
    set,
    retryLoad: () => {
      void query.refetch();
    },
    retryLast: () => {
      if (mutation.variables) mutation.mutate(mutation.variables);
    },
    controlProps: { value, onChange: set, busy: saving, pulse, labels },
  };
}
