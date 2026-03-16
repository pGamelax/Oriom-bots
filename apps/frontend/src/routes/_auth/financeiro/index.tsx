import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { paymentsApi, gatewaysApi, type PaymentFilters } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { QrCode, CheckCircle, Clock, Search, DollarSign, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_auth/financeiro/")({
  component: FinanceiroPage,
});

// ── Date range ────────────────────────────────────────────────────────────

type DateRange = "today" | "yesterday" | "week" | "month" | "all";

const DATE_LABELS: Record<DateRange, string> = {
  today: "Hoje", yesterday: "Ontem", week: "Semana", month: "Mês", all: "Tudo",
};

function getDateRange(range: DateRange): { from?: string; to?: string } {
  const now = new Date();
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const eod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (range === "today")     return { from: sod(now).toISOString(), to: eod(now).toISOString() };
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

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// ── Status ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:   { label: "Pendente",  bg: "bg-amber-100", text: "text-amber-700" },
  paid:      { label: "Pago",      bg: "bg-green-100", text: "text-green-700" },
  expired:   { label: "Expirado",  bg: "bg-gray-100",  text: "text-gray-600"  },
  cancelled: { label: "Cancelado", bg: "bg-red-100",   text: "text-red-700"   },
} as const;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? {
    label: status, bg: "bg-gray-100", text: "text-gray-600",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({ label, count, total, icon: Icon, color }: {
  label: string;
  count: number | undefined;
  total: number | undefined;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <p className="text-sm font-medium text-text-label">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground leading-none">
        {total !== undefined ? formatBRL(total) : "—"}
      </p>
      <p className="text-xs text-text-muted mt-1">
        {count !== undefined ? `${count} transaç${count === 1 ? "ão" : "ões"}` : ""}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

function FinanceiroPage() {
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [gatewayFilter, setGatewayFilter] = useState("__all__");

  const dateParams = useMemo(() => getDateRange(dateRange), [dateRange]);

  const filters: PaymentFilters = {
    ...dateParams,
    ...(search.trim() && { search: search.trim() }),
    ...(statusFilter !== "__all__" && { status: statusFilter }),
    ...(gatewayFilter !== "__all__" && { gatewayId: gatewayFilter }),
  };

  const { data: stats } = useQuery({
    queryKey: ["payments", "stats", dateParams],
    queryFn: () => paymentsApi.stats(dateParams),
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", filters],
    queryFn: () => paymentsApi.list(filters),
  });

  const { data: gateways = [] } = useQuery({
    queryKey: ["gateways"],
    queryFn: gatewaysApi.list,
  });

  function displayUser(p: (typeof payments)[0]) {
    return p.telegramName || `#${p.telegramId}`;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Transações PIX geradas pelos seus bots</p>
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

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatCard
          label="PIX Gerados"
          count={stats?.generated.count}
          total={stats?.generated.total}
          icon={QrCode}
          color="bg-primary"
        />
        <StatCard
          label="PIX Pagos"
          count={stats?.paid.count}
          total={stats?.paid.total}
          icon={CheckCircle}
          color="bg-green-500"
        />
        <StatCard
          label="PIX Pendentes"
          count={stats?.pending.count}
          total={stats?.pending.total}
          icon={Clock}
          color="bg-amber-500"
        />
      </div>

      {/* Table card */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">

        {/* Filters */}
        <div className="p-3 sm:p-4 border-b border-border flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por usuário ou plano..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={gatewayFilter} onValueChange={setGatewayFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todos os gateways" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os gateways</SelectItem>
                {gateways.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle">
                {["Usuário", "Plano", "Gateway", "Status", "Valor", "Data"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-label uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-12 text-text-muted">Carregando...</td></tr>
              )}
              {!isLoading && payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <DollarSign className="w-8 h-8 text-text-placeholder mx-auto mb-2" />
                    <p className="text-sm text-text-muted">Nenhuma transação encontrada</p>
                  </td>
                </tr>
              )}
              {payments.map((p, i) => (
                <tr
                  key={p.id}
                  className={cn(
                    "border-b border-border-subtle hover:bg-surface-raised transition-colors",
                    i === payments.length - 1 && "border-b-0"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-lilac-light flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {displayUser(p)[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-strong truncate max-w-[140px]">{displayUser(p)}</p>
                        <p className="text-xs text-text-muted">@{p.bot.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-text-medium">{p.planName ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-text-label">{p.gateway?.name ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-text-strong">{formatBRL(p.amountInCents)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-text-muted whitespace-nowrap">{formatDate(p.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden">
          {isLoading && (
            <div className="p-6 text-center text-sm text-text-muted">Carregando...</div>
          )}
          {!isLoading && payments.length === 0 && (
            <div className="p-10 text-center">
              <DollarSign className="w-8 h-8 text-text-placeholder mx-auto mb-2" />
              <p className="text-sm text-text-muted">Nenhuma transação encontrada</p>
            </div>
          )}
          {payments.map((p, i) => (
            <div
              key={p.id}
              className={cn(
                "px-4 py-4 flex items-start gap-3",
                i < payments.length - 1 && "border-b border-border-subtle"
              )}
            >
              <div className="w-9 h-9 rounded-full bg-lilac-light flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {displayUser(p)[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-medium text-text-strong truncate">{displayUser(p)}</p>
                    {p.planName && (
                      <p className="text-xs text-text-muted">{p.planName}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-bold text-sm text-text-strong">{formatBRL(p.amountInCents)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs text-text-muted">
                  {p.gateway && <span>{p.gateway.name}</span>}
                  <span>@{p.bot.username}</span>
                  <span className="ml-auto">{formatDate(p.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {!isLoading && payments.length > 0 && (
          <div className="px-4 py-3 border-t border-border-subtle bg-surface-raised flex items-center justify-between">
            <p className="text-xs text-text-muted">
              {payments.length} transaç{payments.length === 1 ? "ão" : "ões"}
            </p>
            {stats && (
              <p className="text-xs font-semibold text-primary">
                Total pago: {formatBRL(stats.paid.total)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
