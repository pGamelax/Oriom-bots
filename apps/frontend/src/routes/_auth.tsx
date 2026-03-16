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
    <div className="flex min-h-screen bg-page-bg">
      <Sidebar />
      <main className="flex-1 md:ml-60 p-6 md:p-8 pb-24 md:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
