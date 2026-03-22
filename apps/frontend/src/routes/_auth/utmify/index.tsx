import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  BarChart2, Plus, Trash2, Pencil, Globe, GitBranch,
  X, Loader2, Eye, EyeOff, FlaskConical,
} from "lucide-react";
import { utmifyApi, flowsApi, type UtmifyTracker, type UtmifyTrackerPayload } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_auth/utmify/")({
  component: UtmifyPage,
});

const inputClass =
  "w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-placeholder";

// ── Form panel ───────────────────────────────────────────────────────────────

function TrackerForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: UtmifyTracker | null;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [scope, setScope] = useState<"global" | "specific">("global");
  const [selectedFlows, setSelectedFlows] = useState<string[]>([]);

  const { data: flows = [] } = useQuery({
    queryKey: ["flows"],
    queryFn: flowsApi.list,
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setToken(editing.token);
        setShowToken(false);
        setScope(editing.scope);
        setSelectedFlows(editing.flows.map((f) => f.flowId));
      } else {
        setName("");
        setToken("");
        setShowToken(false);
        setScope("global");
        setSelectedFlows([]);
      }
    }
  }, [editing, open]);

  const createMutation = useMutation({
    mutationFn: utmifyApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["utmify"] }); toast.success("Tracker criado!"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UtmifyTrackerPayload) => utmifyApi.update(editing!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["utmify"] }); toast.success("Tracker atualizado!"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function toggleFlow(flowId: string) {
    setSelectedFlows((prev) =>
      prev.includes(flowId) ? prev.filter((id) => id !== flowId) : [...prev, flowId]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())  { toast.error("Informe um nome."); return; }
    if (!token.trim()) { toast.error("Informe o API Token."); return; }
    if (scope === "specific" && selectedFlows.length === 0) {
      toast.error("Selecione ao menos um fluxo."); return;
    }

    const payload: UtmifyTrackerPayload = {
      name:    name.trim(),
      token:   token.trim(),
      scope,
      flowIds: scope === "specific" ? selectedFlows : undefined,
    };

    if (editing) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  }

  function flowLabel(flow: (typeof flows)[0]) {
    return flow.name || flow.caption.slice(0, 40);
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface shadow-2xl flex flex-col transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {editing ? "Editar tracker" : "Novo tracker UTMfy"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-text-muted hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">

          {/* Platform badge */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-page-bg">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <BarChart2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-strong">UTMfy</p>
              <p className="text-xs text-text-muted">Rastreamento de conversões via postback</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-text-label uppercase tracking-wide mb-1.5 block">
              Nome / Identificação
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Campanha Maio..."
              className={inputClass}
            />
          </div>

          {/* API Token */}
          <div>
            <label className="text-xs font-semibold text-text-label uppercase tracking-wide mb-1.5 block">
              API Token UTMfy
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Seu token de API do UTMfy"
                className={cn(inputClass, "pr-10")}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-medium transition-colors"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Encontrado em Configurações → API no painel do UTMfy.
            </p>
          </div>

          {/* Scope */}
          <div>
            <label className="text-xs font-semibold text-text-label uppercase tracking-wide mb-1.5 block">
              Uso
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["global", "specific"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-all",
                    scope === s
                      ? "border-primary bg-lilac-light text-primary"
                      : "border-border text-muted-foreground hover:border-border-medium"
                  )}
                >
                  {s === "global" ? <Globe className="w-4 h-4" /> : <GitBranch className="w-4 h-4" />}
                  {s === "global" ? "Global" : "Específico"}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-1.5">
              {scope === "global"
                ? "Dispara conversões para compras de todos os fluxos."
                : "Dispara conversões apenas nos fluxos selecionados abaixo."}
            </p>
          </div>

          {/* Flow selector */}
          {scope === "specific" && (
            <div>
              <label className="text-xs font-semibold text-text-label uppercase tracking-wide mb-1.5 block">
                Fluxos
              </label>
              {flows.length === 0 ? (
                <p className="text-sm text-text-muted">Nenhum fluxo cadastrado.</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {flows.map((flow) => (
                    <label
                      key={flow.id}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all",
                        selectedFlows.includes(flow.id)
                          ? "border-primary bg-lilac-light"
                          : "border-border hover:border-border-medium"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFlows.includes(flow.id)}
                        onChange={() => toggleFlow(flow.id)}
                        className="accent-primary"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-strong truncate">
                          @{flow.bot.username}
                        </p>
                        <p className="text-xs text-text-muted truncate">{flowLabel(flow)}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex-1" />

          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-md shadow-primary/25"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? "Salvando..." : editing ? "Salvar alterações" : "Criar tracker"}
          </button>
        </form>
      </div>
    </>
  );
}

// ── Tracker Card ─────────────────────────────────────────────────────────────

function TrackerCard({
  tracker,
  onEdit,
}: {
  tracker: UtmifyTracker;
  onEdit: (t: UtmifyTracker) => void;
}) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: () => utmifyApi.toggle(tracker.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["utmify"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: () => utmifyApi.test(tracker.id),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Venda de teste enviada! (orderId: ${data.orderId})`);
      } else {
        toast.error(`Falha no teste: ${data.error ?? "erro desconhecido"}`);
      }
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => utmifyApi.delete(tracker.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utmify"] });
      toast.success("Tracker removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-surface rounded-2xl border border-border p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
        <BarChart2 className="w-5 h-5 text-green-600" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text-strong">{tracker.name}</span>
          {!tracker.active && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-text-muted">
              Inativo
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-text-muted">
          {tracker.scope === "global" ? (
            <><Globe className="w-3 h-3" /><span>Global</span></>
          ) : (
            <><GitBranch className="w-3 h-3" /><span>{tracker.flows.length} {tracker.flows.length === 1 ? "fluxo" : "fluxos"}</span></>
          )}
        </div>
      </div>

      {/* Active toggle */}
      <button
        onClick={() => toggleMutation.mutate()}
        disabled={toggleMutation.isPending}
        title={tracker.active ? "Desativar" : "Ativar"}
        className="shrink-0 disabled:opacity-50"
      >
        <div className={cn("w-11 h-6 rounded-full relative transition-colors duration-200", tracker.active ? "bg-primary" : "bg-border")}>
          <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200", tracker.active ? "left-6" : "left-1")} />
        </div>
      </button>

      {/* Test */}
      <button
        onClick={() => testMutation.mutate()}
        disabled={testMutation.isPending}
        title="Enviar venda de teste"
        className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 disabled:opacity-50 transition-all shrink-0"
      >
        {testMutation.isPending
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <FlaskConical className="w-3.5 h-3.5" />}
      </button>

      {/* Edit */}
      <button
        onClick={() => onEdit(tracker)}
        className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-lilac-light hover:text-primary transition-all shrink-0"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {/* Delete */}
      {confirmDelete ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setConfirmDelete(false)}
            className="h-8 px-2.5 rounded-lg text-xs font-medium bg-muted text-text-label hover:bg-border-subtle transition-all"
          >
            Não
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="h-8 px-2.5 rounded-lg text-xs font-medium bg-destructive text-white hover:bg-[oklch(48%_0.22_25)] disabled:opacity-50 transition-all"
          >
            {deleteMutation.isPending ? "..." : "Sim"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-destructive transition-all shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function UtmifyPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingTracker, setEditingTracker] = useState<UtmifyTracker | null>(null);

  const { data: trackers = [], isLoading } = useQuery({
    queryKey: ["utmify"],
    queryFn: utmifyApi.list,
  });

  function openCreate() { setEditingTracker(null); setFormOpen(true); }
  function openEdit(t: UtmifyTracker) { setEditingTracker(t); setFormOpen(true); }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">UTMfy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {trackers.length} {trackers.length === 1 ? "tracker configurado" : "trackers configurados"}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="shrink-0 flex items-center gap-2 h-10 px-3 sm:px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors shadow-md shadow-primary/25"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Adicionar tracker</span>
        </button>
      </div>

      {/* How it works */}
      <div className="bg-surface rounded-2xl border border-border p-4 sm:p-5 mb-6 w-full max-w-2xl">
        <h2 className="text-sm font-semibold text-text-strong mb-3">Como funciona</h2>
        <ol className="flex flex-col gap-2 text-sm text-text-label">
          <li className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
            <span>Crie um link no UTMfy apontando para o link de rastreamento do seu bot (página <strong>Rastreamento</strong>).</span>
          </li>
          <li className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
            <span>O UTMfy adiciona automaticamente o parâmetro <code className="bg-muted px-1 rounded text-xs">clickid</code> ao redirecionar o usuário.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
            <span>Configure abaixo o seu <strong>API Token</strong> do UTMfy. Ao confirmar uma compra, a conversão é enviada automaticamente.</span>
          </li>
        </ol>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border animate-pulse h-20" />
          ))}
        </div>
      ) : trackers.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border border-dashed p-16 flex flex-col items-center justify-center text-center w-full max-w-2xl">
          <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
            <BarChart2 className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="font-semibold text-text-medium mb-1">Nenhum tracker configurado</h3>
          <p className="text-sm text-text-muted mb-5 max-w-xs">
            Adicione seu token do UTMfy para rastrear conversões das suas campanhas.
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar tracker
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full max-w-2xl">
          {trackers.map((tracker) => (
            <TrackerCard key={tracker.id} tracker={tracker} onEdit={openEdit} />
          ))}
        </div>
      )}

      <TrackerForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingTracker(null); }}
        editing={editingTracker}
      />
    </div>
  );
}
