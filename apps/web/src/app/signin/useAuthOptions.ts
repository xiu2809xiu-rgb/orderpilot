import { useQuery } from "@tanstack/react-query";
import { fetchAuthOptions } from "@/lib/api/auth";

/**
 * What the API says about sign-in, such as whether demo mode is on. One query
 * key, so the form and the promise side share a single request.
 */
export function useAuthOptions() {
  return useQuery({
    queryKey: ["auth", "options"],
    queryFn: fetchAuthOptions,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
