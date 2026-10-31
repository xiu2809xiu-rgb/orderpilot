import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RouterProvider, type DataRouter } from "react-router";
import { bootstrapSession } from "@/lib/api/auth";
import { queryClient } from "@/lib/query";
import { AppErrorBoundary } from "./pages/CrashPage";
import { createAppRouter } from "./router";

export function App({ router }: { router?: DataRouter }) {
  const [appRouter] = useState(() => router ?? createAppRouter());

  useEffect(() => {
    void bootstrapSession();
  }, []);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={appRouter} />
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
