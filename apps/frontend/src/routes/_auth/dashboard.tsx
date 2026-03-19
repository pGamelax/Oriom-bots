import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Calendar, DollarSign, TrendingUp, Zap, QrCode, Users,
} from "lucide-react";
import { leadsApi, paymentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

// ── Date helpers ───────────────────────────────────────────────────────────

type DateRange = "today" | "yesterday" | "week" | "month" | "all";

const DATE_LABELS: Record<DateRange, string> = {
  today: "Hoje", yesterday: "Ontem", week: "Semana", month: "Mês", all: "Tudo",
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
  if (range === "week") { const w = new Date(now); w.setDate(w.getDate() - 7); return { from: sod(w).toISOString() }; }
  if (range === "month") { const m = new Date(now); m.setDate(m.getDate() - 30); return { from: sod(m).toISOString() }; }
  return {};
}

function last7Days() {
  const days: Date[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); days.push(d);
  }
  return days;
}

// ── Formatters ─────────────────────────────────────────────────────────────

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── Area Chart ─────────────────────────────────────────────────────────────

function smoothPath(pts: [number, number][]): string {
  if (!pts.length) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }
  return d;
}

function AreaChart({ payments }: { payments: { paidAt: string | null; amountInCents: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const days = useMemo(() => last7Days(), []);

  const data = useMemo(() => days.map((day) => {
    const dayStr = day.toDateString();
    const total = payments
      .filter((p) => p.paidAt && new Date(p.paidAt).toDateString() === dayStr)
      .reduce((s, p) => s + p.amountInCents, 0);
    const label = day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    const fullLabel = day.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" });
    return { label, fullLabel, total };
  }), [days, payments]);

  const W = 700, H = 200, PX = 10, PY = 20;
  const max = Math.max(...data.map((d) => d.total), 1);
  const xStep = (W - PX * 2) / (data.length - 1);
  const pts: [number, number][] = data.map((d, i) => [
    PX + i * xStep,
    H - PY - (d.total / max) * (H - PY * 2.5),
  ]);

  const line = smoothPath(pts);
  const area = line + ` L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round((relX - PX) / xStep);
    setHovered(Math.max(0, Math.min(data.length - 1, idx)));
  }

  const tip = hovered !== null ? { pt: pts[hovered], d: data[hovered] } : null;

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col h-full min-h-[300px]">
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">Seu Desempenho</p>
        <p className="text-[10px] text-text-muted uppercase tracking-widest mt-0.5">Últimos 7 dias</p>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs text-text-muted">Receita</span>
        </div>
      </div>

      {/* Chart + tooltip wrapper */}
      <div className="flex-1 min-h-0 relative">
        {/* Tooltip */}
        {tip && (
          <div
            className="absolute z-10 bg-surface border border-border shadow-lg rounded-xl px-3 py-2 pointer-events-none"
            style={{
              left: `${(tip.pt[0] / W) * 100}%`,
              top: `${(tip.pt[1] / H) * 100}%`,
              transform: "translate(-50%, calc(-100% - 10px))",
            }}
          >
            <p className="text-xs font-bold text-foreground whitespace-nowrap">{formatBRL(tip.d.total)}</p>
            <p className="text-[10px] text-text-muted capitalize whitespace-nowrap">{tip.d.fullLabel}</p>
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={area} fill="url(#grad)" />
          <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" />

          {/* Default dots */}
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={hovered === i ? 0 : 3.5} fill="var(--color-primary)" />
          ))}

          {/* Hover indicator */}
          {tip && (
            <>
              <line
                x1={tip.pt[0]} y1={PY} x2={tip.pt[0]} y2={H}
                stroke="currentColor" strokeWidth="1" strokeDasharray="4 3"
                className="text-border-medium"
              />
              <circle
                cx={tip.pt[0]} cy={tip.pt[1]} r="6"
                fill="var(--color-primary)" stroke="white" strokeWidth="2.5"
              />
            </>
          )}
        </svg>
      </div>

      <div className="flex justify-between mt-2">
        {data.map((d, i) => (
          <span
            key={i}
            className={cn(
              "text-[10px] capitalize flex-1 text-center transition-colors",
              hovered === i ? "text-primary font-semibold" : "text-text-muted"
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Semi-circle Gauge — usa pathLength="100" para não depender do comprimento real do path ──

function ConversionGauge({ pct }: { pct: number }) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  return (
    <svg viewBox="0 0 120 72" className="w-full max-w-[160px] mx-auto">
      {/* Track */}
      <path
        d="M 10 65 A 50 50 0 0 1 110 65"
        fill="none"
        pathLength="100"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        className="text-surface-raised"
      />
      {/* Progress — strokeDashoffset = 100 - pct mostra exatamente pct% do arco */}
      <path
        d="M 10 65 A 50 50 0 0 1 110 65"
        fill="none"
        pathLength="100"
        stroke="var(--color-primary)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="100"
        strokeDashoffset={100 - clamped}
      />
    </svg>
  );
}

// ── Mini bar chart com tooltip ─────────────────────────────────────────────

function MiniBar({ data, days }: { data: number[]; days: Date[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px] h-8 mt-auto pt-2">
      {data.map((v, i) => (
        <div
          key={i}
          className="relative flex-1 group"
          style={{ height: `${Math.max((v / max) * 100, 6)}%` }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className={cn(
            "w-full h-full rounded-sm transition-colors",
            hovered === i ? "bg-primary/70" : "bg-primary/35"
          )} />
          {hovered === i && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 bg-surface border border-border shadow-lg rounded-lg px-2 py-1 whitespace-nowrap pointer-events-none">
              <p className="text-[10px] font-bold text-foreground">{v} PIX</p>
              <p className="text-[9px] text-text-muted capitalize">
                {days[i].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const dateParams = useMemo(() => getDateRange(dateRange), [dateRange]);

  const { data: payStats } = useQuery({
    queryKey: ["payments", "stats", dateParams],
    queryFn: () => paymentsApi.stats(dateParams),
  });

  const { data: leadStats } = useQuery({
    queryKey: ["leads", "stats", dateParams],
    queryFn: () => leadsApi.stats(dateParams),
  });

  const chartFrom = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString();
  }, []);

  const { data: chartPayments = [] } = useQuery({
    queryKey: ["payments", "chart", chartFrom],
    queryFn: () => paymentsApi.list({ status: "paid", from: chartFrom }),
  });

  const { data: recentPayments = [] } = useQuery({
    queryKey: ["payments", "activity"],
    queryFn: () => paymentsApi.list({}),
    select: (d) => d.slice(0, 15),
  });

  const { data: recentLeads = [] } = useQuery({
    queryKey: ["leads", "activity"],
    queryFn: () => leadsApi.list({}),
    select: (d) => d.slice(0, 15),
  });

  const days7 = useMemo(() => last7Days(), []);
  const miniBarData = useMemo(() =>
    days7.map((day) => {
      const s = day.toDateString();
      return recentPayments.filter((p) => new Date(p.createdAt).toDateString() === s).length;
    }), [days7, recentPayments]);

  const activityItems = useMemo(() => {
    const items = [
      ...recentPayments.map((p) => ({
        type: "pix" as const,
        date: p.createdAt,
        title: "PIX Gerado",
        subtitle: `${p.telegramName ?? `#${p.telegramId}`} — Gerou PIX de ${formatBRL(p.amountInCents)}`,
      })),
      ...recentLeads.map((l) => ({
        type: "lead" as const,
        date: l.startedAt,
        title: "Novo Lead",
        subtitle: `${l.name ?? l.username ?? `#${l.telegramId}`} — Iniciou conversa`,
      })),
    ];
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 12);
  }, [recentPayments, recentLeads]);

  // Conversão = PIX pagos / PIX gerados (mesma base do texto do card)
  const conversionRate =
    payStats && payStats.generated.count > 0
      ? (payStats.paid.count / payStats.generated.count) * 100
      : 0;

  const ticketMedio =
    payStats && payStats.paid.count > 0 ? payStats.paid.total / payStats.paid.count : 0;

  const startsPerSale =
    leadStats && leadStats.paid > 0 ? Math.round(leadStats.total / leadStats.paid) : null;

  const approvalPct =
    payStats && payStats.generated.count > 0
      ? ((payStats.paid.count / payStats.generated.count) * 100).toFixed(0)
      : "0";

  const pixProgress =
    payStats && payStats.generated.count > 0
      ? (payStats.paid.count / payStats.generated.count) * 100
      : 0;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão geral da sua operação</p>
      </div>

      {/* ── Period bar ─────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-border px-4 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      {/* ── Main: 2×2 cards + chart ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">

        <div className="lg:col-span-2 grid grid-cols-2 gap-4">

          {/* Vendas Aprovadas */}
          <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[11px] font-semibold text-text-muted leading-tight">Vendas Aprovadas</span>
            </div>
            <p className="text-[1.6rem] font-bold text-foreground leading-none">
              {payStats ? formatBRL(payStats.paid.total) : "—"}
            </p>
            <div className="mt-auto">
              <div className="h-1 rounded-full bg-surface-raised overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(pixProgress, 100)}%` }} />
              </div>
              <p className="text-[11px] text-text-muted text-right mt-1">{approvalPct}% Aprov.</p>
            </div>
          </div>

          {/* Taxa de Conversão */}
          <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[11px] font-semibold text-text-muted leading-tight">Taxa de Conversão</span>
            </div>
            <ConversionGauge pct={conversionRate} />
            <div className="text-center -mt-2">
              <p className="text-xl font-bold text-foreground">{conversionRate.toFixed(2)}%</p>
              <p className="text-[10px] text-text-muted mt-0.5">
                {payStats?.paid.count ?? 0} pagos de {payStats?.generated.count ?? 0} PIX
              </p>
            </div>
          </div>

          {/* Total Starts */}
          <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[11px] font-semibold text-text-muted leading-tight">Total Starts</span>
            </div>
            <p className="text-[1.6rem] font-bold text-foreground leading-none">{leadStats?.total ?? "—"}</p>
            <p className="text-[11px] text-text-muted">Leads iniciaram conversa</p>
            {startsPerSale !== null && (
              <p className="text-[11px] text-text-muted">
                <span className="text-foreground font-semibold">{startsPerSale}</span> starts por venda
              </p>
            )}
            <MiniBar data={miniBarData} days={days7} />
          </div>

          {/* Ticket Médio */}
          <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <QrCode className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[11px] font-semibold text-text-muted leading-tight">Ticket Médio</span>
            </div>
            <p className="text-[1.6rem] font-bold text-foreground leading-none">
              {ticketMedio > 0 ? formatBRL(ticketMedio) : "—"}
            </p>
            <p className="text-[11px] text-text-muted">
              Vendas: <span className="text-foreground font-semibold">{payStats ? formatBRL(payStats.paid.total) : "—"}</span>
            </p>
            <div className="mt-auto pt-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-text-muted">PIX Pagos</span>
                <span className="text-foreground font-semibold">{payStats?.paid.count ?? 0}</span>
              </div>
              <div className="h-1 rounded-full bg-surface-raised overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(pixProgress, 100)}%` }} />
              </div>
              <p className="text-[10px] text-text-muted text-right mt-1">
                de {payStats?.generated.count ?? 0} PIX gerados
              </p>
            </div>
          </div>
        </div>

        {/* Area chart */}
        <div className="lg:col-span-3">
          <AreaChart payments={chartPayments} />
        </div>
      </div>

      {/* ── Log de Atividades ─────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Log de Atividades</p>
            <p className="text-[10px] text-text-muted uppercase tracking-widest">Tempo real</p>
          </div>
        </div>

        {activityItems.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-text-muted">Nenhuma atividade registrada</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activityItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                  item.type === "pix" ? "bg-amber-500/15" : "bg-primary/15"
                )}>
                  {item.type === "pix"
                    ? <Zap className="w-4 h-4 text-amber-500" />
                    : <Users className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-text-muted truncate">{item.subtitle}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-text-label">{timeAgo(item.date)}</p>
                  <p className="text-[10px] text-text-muted">{formatShortDate(item.date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
