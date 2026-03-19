import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { Sidebar } from "@/components/layout/sidebar";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/sign-in" });
    }
    return { user: session.data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-dvh bg-page-bg">
      <Sidebar />
      <main className="md:ml-60 px-4 sm:px-6 md:px-8 safe-bottom-content">
        <Outlet />
      </main>
    </div>
  );
}
