import { useQuery } from "@tanstack/react-query";
import { fetchAuthOptions } from "@/lib/api/auth";

/**
 * Whether the API says this is a demo (`GET /auth/options`). It is the same
 * query, with the same key, as the role switcher's, so the answer is fetched once.
 */
export function useDemoMode(): boolean {
  const options = useQuery({
    queryKey: ["auth", "options"],
    queryFn: fetchAuthOptions,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return options.data?.demoMode === true;
}
