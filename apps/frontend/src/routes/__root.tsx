import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

interface RouterContext {
  queryClient: QueryClient;
}

function RootComponent() {
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (stored === "dark" || (!stored && prefersDark)) {
      document.documentElement.classList.add("dark");
    }
  }, []);
  return <Outlet />;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});
