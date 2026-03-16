import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { remarketingsApi, type Remarketing } from "@/lib/api";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Loader2,
  Megaphone,
  Pencil,
  Play,
  Plus,
  Power,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/remarketings/")({
  component: RemarketingsPage,
});

type Audience = "all" | "new" | "pending" | "paid";

const AUDIENCE_CONFIG: Record<
  Audience,
  { label: string; color: string; bg: string }
> = {
  all: {
    label: "Todos os leads",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  new: { label: "Nunca gerou PIX", color: "text-blue-700", bg: "bg-blue-100" },
  pending: {
    label: "Gerou PIX, não pagou",
    color: "text-amber-700",
    bg: "bg-amber-100",
  },
  paid: { label: "Já comprou", color: "text-green-700", bg: "bg-green-100" },
};

const INTERVAL_LABELS: Record<number, string> = {
  1: "1 min",
  5: "5 min",
  10: "10 min",
  15: "15 min",
  20: "20 min",
  30: "30 min",
  60: "1h",
  120: "2h",
  180: "3h",
  360: "6h",
  720: "12h",
  1440: "24h",
};

function intervalLabel(minutes: number) {
  return INTERVAL_LABELS[minutes] ?? `${minutes}min`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function formatLastRun(iso: string | null) {
  if (!iso) return "Nunca executado";
  return formatDate(iso);
}

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function LogsTable({ remarketing }: { remarketing: Remarketing }) {
  const logs = remarketing.logs;
  const stats = remarketing.paymentStats;

  if (logs.length === 0) {
    return (
      <div className="px-5 pb-5">
        <div className="border border-dashed border-border rounded-xl p-4 text-center">
          <p className="text-xs text-text-muted">
            Nenhum disparo registrado ainda.
          </p>
        </div>
      </div>
    );
  }

  const totalSent = logs.reduce((s, l) => s + l.sent, 0);
  const totalBlocked = logs.reduce((s, l) => s + l.blocked, 0);

  return (
    <div className="px-5 pb-5">
      {/* Aggregate stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        {[
          { label: "Enviados", value: totalSent },
          { label: "Bloqueados", value: totalBlocked },
          { label: "PIX gerados", value: stats.generated },
          { label: "PIX pagos", value: stats.paid },
          { label: "Receita", value: fmtBRL(stats.revenueInCents) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-surface-subtle rounded-xl border border-border px-3 py-2 text-center"
          >
            <p className="text-xs text-text-muted">{label}</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Logs table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-subtle">
              <th className="text-left px-3 py-2 font-medium text-text-muted whitespace-nowrap">
                #
              </th>
              <th className="text-left px-3 py-2 font-medium text-text-muted whitespace-nowrap">
                Início
              </th>
              <th className="text-left px-3 py-2 font-medium text-text-muted whitespace-nowrap">
                Fim
              </th>
              <th className="text-right px-3 py-2 font-medium text-text-muted">
                Enviados
              </th>
              <th className="text-right px-3 py-2 font-medium text-text-muted">
                Bloqueados
              </th>
              <th className="text-left px-3 py-2 font-medium text-text-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, idx) => (
              <tr
                key={log.id}
                className="border-b border-border last:border-0 hover:bg-surface-subtle/50"
              >
                <td className="px-3 py-2 text-text-muted">
                  {logs.length - idx}
                </td>
                <td className="px-3 py-2 text-foreground whitespace-nowrap">
                  {formatDate(log.startedAt)}
                </td>
                <td className="px-3 py-2 text-foreground whitespace-nowrap">
                  {log.finishedAt ? (
                    formatDate(log.finishedAt)
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-medium">{log.sent}</td>
                <td className="px-3 py-2 text-right text-amber-600">
                  {log.blocked || "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full font-medium",
                      log.finishedAt
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {log.finishedAt ? "Finalizado" : "Em andamento"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RemarketingCard({
  remarketing,
  onToggle,
  onRun,
  onDelete,
}: {
  remarketing: Remarketing;
  onToggle: () => void;
  onRun: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const aud = AUDIENCE_CONFIG[remarketing.targetAudience as Audience];

  return (
    <div
      className={cn(
        "bg-surface rounded-2xl border border-border transition-opacity",
        !remarketing.active && "opacity-60",
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {remarketing.name}
              </h3>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  aud?.bg,
                  aud?.color,
                )}
              >
                {aud?.label}
              </span>
              {!remarketing.active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  Pausado
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              @{remarketing.flow.bot.username} ·{" "}
              {remarketing.flow.name ?? remarketing.flow.caption.slice(0, 40)}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onRun}
              title="Executar agora"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-raised hover:text-foreground transition-colors"
            >
              <Play className="w-4 h-4" />
            </button>
            <button
              onClick={onToggle}
              title={remarketing.active ? "Pausar" : "Ativar"}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-raised hover:text-foreground transition-colors"
            >
              <Power className="w-4 h-4" />
            </button>
            <Link
              to="/remarketings/$remarketingId/edit"
              params={{ remarketingId: remarketing.id }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-raised hover:text-foreground transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </Link>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={onDelete}
                  className="h-8 px-2 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-raised transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Início: {intervalLabel(remarketing.startAfterMinutes)} · Repetir: {intervalLabel(remarketing.intervalMinutes)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {remarketing.buttons.length} plano
            {remarketing.buttons.length !== 1 ? "s" : ""}
          </span>
          <span>Último envio: {formatLastRun(remarketing.lastRunAt)}</span>
          {remarketing.paymentStats.revenueInCents > 0 && (
            <span className="text-green-600 font-medium">
              {fmtBRL(remarketing.paymentStats.revenueInCents)} gerados
            </span>
          )}
        </div>
      </div>

      {/* Logs toggle */}
      <div className="border-t border-border">
        <button
          onClick={() => setShowLogs((v) => !v)}
          className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-text-muted hover:bg-surface-subtle transition-colors rounded-b-2xl"
        >
          <History className="w-3.5 h-3.5" />
          Histórico de disparos ({remarketing.logs.length})
          {showLogs ? (
            <ChevronUp className="w-3.5 h-3.5 ml-auto" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 ml-auto" />
          )}
        </button>
        {showLogs && <LogsTable remarketing={remarketing} />}
      </div>
    </div>
  );
}

function RemarketingsPage() {
  const qc = useQueryClient();

  const { data: remarketings = [], isLoading } = useQuery({
    queryKey: ["remarketings"],
    queryFn: remarketingsApi.list,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["remarketings"] });

  const toggleMutation = useMutation({
    mutationFn: remarketingsApi.toggle,
    onSuccess: invalidate,
  });

  const runMutation = useMutation({
    mutationFn: remarketingsApi.run,
    onSuccess: () => {
      invalidate();
      toast.success("Remarketing será executado em breve.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: remarketingsApi.delete,
    onSuccess: invalidate,
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Remarketings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Envios automáticos periódicos para reengajar seus leads
          </p>
        </div>
        <Link
          to="/remarketings/new"
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo remarketing
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      ) : remarketings.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-dashed border-border p-12 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <Megaphone className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">
            Nenhum remarketing
          </h3>
          <p className="text-sm text-text-muted max-w-xs mb-4">
            Crie um remarketing para reengajar seus leads automaticamente.
          </p>
          <button className="h-9 px-4 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
            <Link to="/remarketings/new">Criar primeiro remarketing</Link>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {remarketings.map((r) => (
            <RemarketingCard
              key={r.id}
              remarketing={r}
              onToggle={() => toggleMutation.mutate(r.id)}
              onRun={() => runMutation.mutate(r.id)}
              onDelete={() => deleteMutation.mutate(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
