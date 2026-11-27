import { useQuery } from "@tanstack/react-query";
import { fetchTwoStepStatus } from "@/lib/api/two-step";
import { useSessionStore } from "@/stores/session";

/** The key holds the person, so a change of person can never show another's state. */
export const twoStepStatusKey = (userId: string | undefined) =>
  ["two-step", userId] as const;

/** Whether two-step is on for the signed-in person, and what the card may offer. */
export function useTwoStepStatus() {
  const userId = useSessionStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: twoStepStatusKey(userId),
    queryFn: fetchTwoStepStatus,
  });
}
