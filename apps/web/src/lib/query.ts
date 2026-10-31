import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api/errors";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // A 4xx answer will not change by asking again.
        retry: (failures, error) =>
          failures < 2 && !(error instanceof ApiError && error.status < 500),
      },
    },
  });
}

export const queryClient = createQueryClient();
