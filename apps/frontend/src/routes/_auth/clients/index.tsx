import { useState, useMemo, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { leadsApi, botsApi, flowsApi, type LeadFilters, type Lead, type ChatMessage } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, TrendingUp, Clock, CheckCircle, Ban, Search, Calendar, MessageSquare, X, RefreshCw, Bot, Image, Video, Smile, MousePointerClick } from "lucide-react";
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

// ── Chat Dialog ───────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isBot = msg.from === "bot";
  const isCallback = msg.type === "callback";
  const time = new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Callback actions rendered as a centered pill, not a bubble
  if (isCallback) {
    return (
      <div className="flex items-center justify-center gap-2 my-1">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
          <MousePointerClick className="w-3 h-3 shrink-0" />
          {msg.text}
          <span className="text-amber-400 font-normal ml-1">{time}</span>
        </div>
      </div>
    );
  }

  function content() {
    if (msg.type === "photo") return (
      <span className="flex items-center gap-1.5 italic opacity-80"><Image className="w-3.5 h-3.5 shrink-0" />{msg.caption || "Foto"}</span>
    );
    if (msg.type === "video") return (
      <span className="flex items-center gap-1.5 italic opacity-80"><Video className="w-3.5 h-3.5 shrink-0" />{msg.caption || "Vídeo"}</span>
    );
    if (msg.type === "sticker") return (
      <span className="flex items-center gap-1.5 italic opacity-80"><Smile className="w-3.5 h-3.5 shrink-0" />{msg.text || "Sticker"}</span>
    );
    return <span className="whitespace-pre-wrap">{msg.text}</span>;
  }

  return (
    <div className={cn("flex gap-2 items-end", isBot ? "flex-row" : "flex-row-reverse")}>
      {isBot && (
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mb-0.5">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
          isBot
            ? "bg-surface border border-border text-foreground rounded-bl-sm"
            : "bg-primary text-white rounded-br-sm"
        )}
      >
        {content()}
        <p className={cn("text-[10px] mt-1 text-right", isBot ? "text-text-muted" : "text-white/60")}>{time}</p>
      </div>
    </div>
  );
}

function ChatDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["chat", lead.botId, lead.telegramId],
    queryFn: () => leadsApi.chat(lead.botId, lead.telegramId),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const displayName = lead.name ?? (lead.username ? `@${lead.username}` : `#${lead.telegramId}`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col shadow-2xl border border-border max-h-[85dvh] sm:max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-full bg-lilac-light flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{displayName[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-text-muted">@{lead.bot.username}</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-raised transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-raised transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          )}
          {!isLoading && messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-8">
              <MessageSquare className="w-8 h-8 text-text-placeholder" />
              <p className="text-sm text-text-muted">Nenhuma mensagem ainda</p>
              <p className="text-xs text-text-subtle">As mensagens aparecem aqui em tempo real após o usuário interagir com o bot</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <ChatBubble key={i} msg={msg} />
          ))}
        </div>

        {/* Footer note */}
        <div className="px-4 py-2.5 border-t border-border-subtle shrink-0">
          <p className="text-[11px] text-text-subtle text-center">Histórico em memória · Atualiza a cada 5s</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

function ClientsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [botFilter, setBotFilter] = useState("__all__");
  const [flowFilter, setFlowFilter] = useState("__all__");
  const [chatLead, setChatLead] = useState<Lead | null>(null);

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

  return (
    <>
    {chatLead && <ChatDialog lead={chatLead} onClose={() => setChatLead(null)} />}
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Clientes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Usuários que interagiram com seus bots</p>
      </div>

      {/* Period bar */}
      <div className="bg-surface rounded-2xl border border-border px-4 sm:px-5 py-3 mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                    <button
                      onClick={() => setChatLead(lead)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200 whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Chat
                    </button>
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
                    <button
                      onClick={() => setChatLead(lead)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
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
    </>
  );
}
