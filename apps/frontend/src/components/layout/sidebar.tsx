import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bot, CreditCard, GitBranch, LayoutDashboard, LogOut,
  Megaphone, Moon, Sun, User, Users, DollarSign, Scan, Link2, BarChart2,
  Menu, X,
} from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTheme } from "@/lib/theme";

const navGroups = [
  {
    label: "Geral",
    items: [
      { to: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
      { to: "/financeiro", icon: DollarSign,      label: "Financeiro" },
      { to: "/clients",    icon: Users,           label: "Clientes" },
    ],
  },
  {
    label: "Automações",
    items: [
      { to: "/bots",         icon: Bot,        label: "Meus Bots" },
      { to: "/flows",        icon: GitBranch,  label: "Fluxos" },
      { to: "/remarketings", icon: Megaphone,  label: "Remarketings" },
      { to: "/tracking",     icon: Link2,      label: "Rastreamento" },
    ],
  },
  {
    label: "Integrações",
    items: [
      { to: "/gateways", icon: CreditCard, label: "Gateways" },
      { to: "/pixels",   icon: Scan,       label: "Pixels" },
      { to: "/utmify",   icon: BarChart2,  label: "UTMfy" },
    ],
  },
];

// Flat list for mobile bottom bar
const mobileMainItems = ["/dashboard", "/bots", "/flows", "/clients"];
const navItems = navGroups.flatMap((g) => g.items);

function useActivePath() {
  const router = useRouterState();
  const currentPath = router.location.pathname;
  return (to: string) => currentPath === to || currentPath.startsWith(to + "/");
}

// ── Desktop + Mobile Sheet Sidebar ───────────────────────────────────────────

export function Sidebar() {
  const { data: session } = useSession();
  const isActive = useActivePath();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { theme, toggle } = useTheme();

  async function handleSignOut() {
    await signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/sign-in"; } } });
  }

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex flex-col gap-5">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted px-3 mb-1">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 h-9 px-3 rounded-lg text-sm font-medium transition-all",
                    isActive(to)
                      ? "bg-lilac-light text-primary"
                      : "text-text-label hover:bg-surface-subtle hover:text-text-medium"
                  )}
                >
                  <Icon className={cn("w-4 h-4 shrink-0", isActive(to) && "text-primary")} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-20 w-60 flex-col bg-surface border-r border-border hidden md:flex" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/30">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground">Oriom Bots</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <NavLinks />
        </nav>

        {/* User */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-lilac-light flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-strong truncate">{session?.user.name}</p>
              <p className="text-xs text-text-muted truncate">{session?.user.email}</p>
            </div>
            <button
              onClick={toggle}
              title={theme === "dark" ? "Tema claro" : "Tema escuro"}
              className="p-1.5 rounded-md text-text-label hover:bg-surface-subtle transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSignOut}
              title="Sair"
              className="p-1.5 rounded-md text-text-muted hover:bg-surface-subtle hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom navbar ────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border safe-bottom">
        <div className="flex items-stretch h-16">
          {/* 4 main items */}
          {navItems
            .filter((item) => mobileMainItems.includes(item.to))
            .map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                title={label}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 transition-colors",
                  isActive(to) ? "text-primary" : "text-text-muted"
                )}
              >
                <div className={cn(
                  "w-10 h-8 rounded-full flex items-center justify-center transition-all",
                  isActive(to) ? "bg-lilac-light" : ""
                )}>
                  <Icon className="w-5 h-5" />
                </div>
              </Link>
            ))}

          {/* Menu button → opens sheet */}
          <button
            onClick={() => setSheetOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-text-muted transition-colors"
          >
            <div className="w-10 h-8 rounded-full flex items-center justify-center">
              <Menu className="w-5 h-5" />
            </div>
          </button>
        </div>
      </nav>

      {/* ── Mobile sheet ────────────────────────────────────────────────────── */}
      {/* Overlay */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          sheetOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSheetOpen(false)}
      />

      {/* Panel */}
      <div
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-surface flex flex-col transition-transform duration-300 shadow-2xl",
          sheetOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sheet header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/30">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground">Oriom Bots</span>
          </div>
          <button
            onClick={() => setSheetOpen(false)}
            className="p-1.5 rounded-md text-text-muted hover:bg-surface-subtle transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <NavLinks onNavigate={() => setSheetOpen(false)} />
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-lilac-light flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-strong truncate">{session?.user.name}</p>
              <p className="text-xs text-text-muted truncate">{session?.user.email}</p>
            </div>
            <button
              onClick={toggle}
              title={theme === "dark" ? "Tema claro" : "Tema escuro"}
              className="p-1.5 rounded-md text-text-label hover:bg-surface-subtle transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSignOut}
              title="Sair"
              className="p-1.5 rounded-md text-text-muted hover:bg-surface-subtle hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
