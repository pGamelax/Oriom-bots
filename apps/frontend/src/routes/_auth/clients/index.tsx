import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { leadsApi, botsApi, flowsApi, type LeadFilters } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, TrendingUp, Clock, CheckCircle, Ban, Search, Calendar, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_auth/clients/")({
  component: ClientsPage,
});

// ── Date range ────────────────────────────────────────────────────────────

type DateRange = "today" | "yesterday" | "week" | "month" | "all";

const DATE_LABELS: Record<DateRange, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  week: "Semana",
  month: "Mês",
  all: "Tudo",
};

function getDateRange(range: DateRange): { from?: string; to?: string } {
  const now = new Date();
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const eod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (range === "today") return { from: sod(now).toISOString(), to: eod(now).toISOString() };
  if (range === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { from: sod(y).toISOString(), to: eod(y).toISOString() };
  }
  if (range === "week") {
    const w = new Date(now); w.setDate(w.getDate() - 7);
    return { from: sod(w).toISOString() };
  }
  if (range === "month") {
    const m = new Date(now); m.setDate(m.getDate() - 30);
    return { from: sod(m).toISOString() };
  }
  return {};
}

// ── Status ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  new:     { label: "Novo",      bg: "bg-blue-100",  text: "text-blue-700"  },
  pending: { label: "Pendente",  bg: "bg-amber-100", text: "text-amber-700" },
  paid:    { label: "Pago",      bg: "bg-green-100", text: "text-green-700" },
  blocked: { label: "Bloqueado", bg: "bg-red-100",   text: "text-red-700"   },
} as const;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? {
    label: status, bg: "bg-gray-100", text: "text-gray-700",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number | undefined; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-foreground leading-none">{value ?? "—"}</p>
        <p className="text-xs text-text-muted mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

function ClientsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [botFilter, setBotFilter] = useState("__all__");
  const [flowFilter, setFlowFilter] = useState("__all__");

  const dateParams = useMemo(() => getDateRange(dateRange), [dateRange]);

  const filters: LeadFilters = {
    ...dateParams,
    ...(search.trim() && { search: search.trim() }),
    ...(statusFilter !== "__all__" && { status: statusFilter }),
    ...(botFilter !== "__all__" && { botId: botFilter }),
    ...(flowFilter !== "__all__" && { flowId: flowFilter }),
  };

  const { data: stats } = useQuery({
    queryKey: ["leads", "stats", dateParams],
    queryFn: () => leadsApi.stats(dateParams),
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", filters],
    queryFn: () => leadsApi.list(filters),
  });

  const { data: bots = [] } = useQuery({ queryKey: ["bots"], queryFn: botsApi.list });
  const { data: flows = [] } = useQuery({ queryKey: ["flows"], queryFn: flowsApi.list });

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  }

  function displayName(lead: (typeof leads)[0]) {
    if (lead.name) return lead.name;
    if (lead.username) return `@${lead.username}`;
    return `#${lead.telegramId}`;
  }

  function flowLabel(f: { name: string | null; caption: string }) {
    return f.name || (f.caption.length > 30 ? f.caption.slice(0, 30) + "…" : f.caption);
  }

  function telegramChatUrl(lead: (typeof leads)[0]) {
    if (lead.username) return `https://t.me/${lead.username}`;
    return `tg://user?id=${lead.telegramId}`;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Usuários que interagiram com seus bots</p>
      </div>

      {/* Period bar */}
      <div className="bg-surface rounded-2xl border border-border px-5 py-3 mb-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-text-muted">
          <Calendar className="w-4 h-4" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">Período</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.keys(DATE_LABELS) as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={cn(
                "h-8 px-4 rounded-full text-sm font-medium transition-all",
                dateRange === range
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface border border-border text-text-label hover:border-border-medium"
              )}
            >
              {DATE_LABELS[range]}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards — 2 cols mobile, 3 sm, 5 lg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <StatCard label="Total" value={stats?.total} icon={Users} color="bg-primary" />
        <StatCard label="Novos" value={stats?.new} icon={TrendingUp} color="bg-blue-500" />
        <StatCard label="Pendentes" value={stats?.pending} icon={Clock} color="bg-amber-500" />
        <StatCard label="Pagos" value={stats?.paid} icon={CheckCircle} color="bg-green-500" />
        <StatCard label="Bloqueados" value={stats?.blocked} icon={Ban} color="bg-red-500" />
      </div>

      {/* Table card */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">

        {/* Filters */}
        <div className="p-3 sm:p-4 border-b border-border flex flex-col gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou ID..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Dropdowns — row on sm+, stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os status</SelectItem>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={botFilter} onValueChange={setBotFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todos os bots" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os bots</SelectItem>
                {bots.map((b) => (
                  <SelectItem key={b.id} value={b.id}>@{b.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={flowFilter} onValueChange={setFlowFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todos os fluxos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os fluxos</SelectItem>
                {flows.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{flowLabel(f)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Desktop table — hidden on mobile */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle">
                {["Nome", "Plano", "Bot", "Fluxo", "Status", "Data", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-label uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leadsLoading && (
                <tr><td colSpan={7} className="text-center py-12 text-text-muted">Carregando...</td></tr>
              )}
              {!leadsLoading && leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Users className="w-8 h-8 text-text-placeholder mx-auto mb-2" />
                    <p className="text-sm text-text-muted">Nenhum cliente encontrado</p>
                  </td>
                </tr>
              )}
              {leads.map((lead, i) => (
                <tr
                  key={lead.id}
                  className={cn(
                    "border-b border-border-subtle hover:bg-surface-raised transition-colors",
                    i === leads.length - 1 && "border-b-0"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-lilac-light flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {(lead.name ?? lead.username ?? lead.telegramId)[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-strong truncate max-w-[140px]">{displayName(lead)}</p>
                        {lead.username && lead.name && (
                          <p className="text-xs text-text-muted">@{lead.username}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {lead.planName ? (
                      <div>
                        <p className="font-medium text-text-strong">{lead.planName}</p>
                        {lead.planValue != null && (
                          <p className="text-xs text-primary font-semibold">
                            R$ {lead.planValue.toFixed(2).replace(".", ",")}
                          </p>
                        )}
                      </div>
                    ) : <span className="text-text-subtle">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-text-medium">@{lead.bot.username}</span>
                  </td>
                  <td className="px-4 py-3">
                    {lead.flow ? (
                      <span className="text-text-label max-w-[160px] truncate block">
                        {flowLabel(lead.flow)}
                      </span>
                    ) : <span className="text-text-subtle">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-text-muted whitespace-nowrap">{formatDate(lead.startedAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={telegramChatUrl(lead)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver chat no Telegram"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200 whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Chat
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list — visible only on mobile */}
        <div className="md:hidden">
          {leadsLoading && (
            <div className="p-6 text-center text-sm text-text-muted">Carregando...</div>
          )}
          {!leadsLoading && leads.length === 0 && (
            <div className="p-10 text-center">
              <Users className="w-8 h-8 text-text-placeholder mx-auto mb-2" />
              <p className="text-sm text-text-muted">Nenhum cliente encontrado</p>
            </div>
          )}
          {leads.map((lead, i) => (
            <div
              key={lead.id}
              className={cn(
                "px-4 py-4 flex items-start gap-3",
                i < leads.length - 1 && "border-b border-border-subtle"
              )}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-lilac-light flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {(lead.name ?? lead.username ?? lead.telegramId)[0]?.toUpperCase()}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-text-strong truncate">{displayName(lead)}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={lead.status} />
                    <a
                      href={telegramChatUrl(lead)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver chat no Telegram"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
                  <span>@{lead.bot.username}</span>
                  {lead.flow && <span>{flowLabel(lead.flow)}</span>}
                  {lead.planName && (
                    <span className="text-primary font-medium">
                      {lead.planName}
                      {lead.planValue != null && ` · R$ ${lead.planValue.toFixed(2).replace(".", ",")}`}
                    </span>
                  )}
                  <span className="ml-auto">{formatDate(lead.startedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {!leadsLoading && leads.length > 0 && (
          <div className="px-4 py-3 border-t border-border-subtle bg-surface-raised">
            <p className="text-xs text-text-muted">
              {leads.length} cliente{leads.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
