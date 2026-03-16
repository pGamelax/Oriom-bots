import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Facebook, Plus, Trash2, Pencil, Globe, GitBranch,
  X, Loader2, Eye, EyeOff, FlaskConical,
} from "lucide-react";
import { pixelsApi, flowsApi, type Pixel, type PixelPayload } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_auth/pixels/")({
  component: PixelsPage,
});

const inputClass =
  "w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-placeholder";

// ── Form panel ───────────────────────────────────────────────────────────────

function PixelForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Pixel | null;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testEventCode, setTestEventCode] = useState("");
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
        setPixelId(editing.pixelId);
        setAccessToken(editing.accessToken);
        setShowToken(false);
        setTestEventCode(editing.testEventCode ?? "");
        setScope(editing.scope);
        setSelectedFlows(editing.flows.map((f) => f.flowId));
      } else {
        setName("");
        setPixelId("");
        setAccessToken("");
        setShowToken(false);
        setTestEventCode("");
        setScope("global");
        setSelectedFlows([]);
      }
    }
  }, [editing, open]);

  const createMutation = useMutation({
    mutationFn: pixelsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pixels"] }); toast.success("Pixel criado!"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: PixelPayload) => pixelsApi.update(editing!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pixels"] }); toast.success("Pixel atualizado!"); onClose(); },
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
    if (!name.trim())        { toast.error("Informe um nome."); return; }
    if (!pixelId.trim())     { toast.error("Informe o Pixel ID."); return; }
    if (!accessToken.trim()) { toast.error("Informe o Access Token."); return; }
    if (scope === "specific" && selectedFlows.length === 0) {
      toast.error("Selecione ao menos um fluxo."); return;
    }

    const payload: PixelPayload = {
      name:          name.trim(),
      pixelId:       pixelId.trim(),
      accessToken:   accessToken.trim(),
      testEventCode: testEventCode.trim() || undefined,
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {editing ? "Editar pixel" : "Novo pixel"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-text-muted hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* Platform badge */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-page-bg">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Facebook className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-strong">Facebook / Meta Ads</p>
              <p className="text-xs text-text-muted">Conversions API (CAPI)</p>
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
              placeholder="Ex: Campanha Principal..."
              className={inputClass}
            />
          </div>

          {/* Pixel ID */}
          <div>
            <label className="text-xs font-semibold text-text-label uppercase tracking-wide mb-1.5 block">
              Pixel ID
            </label>
            <input
              type="text"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder="Ex: 1234567890123456"
              className={inputClass}
            />
            <p className="text-xs text-text-muted mt-1">
              Encontrado em Gerenciador de Eventos → Configurações.
            </p>
          </div>

          {/* Access Token */}
          <div>
            <label className="text-xs font-semibold text-text-label uppercase tracking-wide mb-1.5 block">
              Access Token (CAPI)
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Token de acesso da Conversions API"
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
              Gerenciador de Eventos → Configurações → Conversions API → Gerar token de acesso.
            </p>
          </div>

          {/* Test Event Code */}
          <div>
            <label className="text-xs font-semibold text-text-label uppercase tracking-wide mb-1.5 block flex items-center gap-1.5">
              <FlaskConical className="w-3 h-3" />
              Código de Evento de Teste
              <span className="normal-case font-normal text-text-subtle">(opcional)</span>
            </label>
            <input
              type="text"
              value={testEventCode}
              onChange={(e) => setTestEventCode(e.target.value)}
              placeholder="Ex: TEST12345"
              className={inputClass}
            />
            <p className="text-xs text-text-muted mt-1">
              Usado para testar eventos sem afetar dados reais de campanha.
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
                ? "Dispara eventos para compras de todos os fluxos."
                : "Dispara eventos apenas nos fluxos selecionados abaixo."}
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
            {isPending ? "Salvando..." : editing ? "Salvar alterações" : "Criar pixel"}
          </button>
        </form>
      </div>
    </>
  );
}

// ── Pixel Card ───────────────────────────────────────────────────────────────

function PixelCard({
  pixel,
  onEdit,
}: {
  pixel: Pixel;
  onEdit: (p: Pixel) => void;
}) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: () => pixelsApi.toggle(pixel.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pixels"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => pixelsApi.delete(pixel.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pixels"] });
      toast.success("Pixel removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-3">
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
        <Facebook className="w-5 h-5 text-blue-600" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text-strong">{pixel.name}</span>
          {pixel.testEventCode && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <FlaskConical className="w-2.5 h-2.5" />
              Teste
            </span>
          )}
          {!pixel.active && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-text-muted">
              Inativo
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted mt-0.5 font-mono">{pixel.pixelId}</p>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-text-muted">
          {pixel.scope === "global" ? (
            <><Globe className="w-3 h-3" /><span>Global</span></>
          ) : (
            <><GitBranch className="w-3 h-3" /><span>{pixel.flows.length} {pixel.flows.length === 1 ? "fluxo" : "fluxos"}</span></>
          )}
        </div>
      </div>

      {/* Active toggle */}
      <button
        onClick={() => toggleMutation.mutate()}
        disabled={toggleMutation.isPending}
        title={pixel.active ? "Desativar" : "Ativar"}
        className="shrink-0 disabled:opacity-50"
      >
        <div className={cn("w-11 h-6 rounded-full relative transition-colors duration-200", pixel.active ? "bg-primary" : "bg-border")}>
          <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200", pixel.active ? "left-6" : "left-1")} />
        </div>
      </button>

      {/* Edit */}
      <button
        onClick={() => onEdit(pixel)}
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

function PixelsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingPixel, setEditingPixel] = useState<Pixel | null>(null);

  const { data: pixels = [], isLoading } = useQuery({
    queryKey: ["pixels"],
    queryFn: pixelsApi.list,
  });

  function openCreate() { setEditingPixel(null); setFormOpen(true); }
  function openEdit(p: Pixel) { setEditingPixel(p); setFormOpen(true); }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pixels de Rastreamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pixels.length} {pixels.length === 1 ? "pixel configurado" : "pixels configurados"}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors shadow-md shadow-primary/25"
        >
          <Plus className="w-4 h-4" />
          Adicionar pixel
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border animate-pulse h-20" />
          ))}
        </div>
      ) : pixels.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border border-dashed p-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <Facebook className="w-7 h-7 text-blue-600" />
          </div>
          <h3 className="font-semibold text-text-medium mb-1">Nenhum pixel configurado</h3>
          <p className="text-sm text-text-muted mb-5 max-w-xs">
            Adicione seu Pixel do Facebook para rastrear compras e otimizar suas campanhas.
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar pixel
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl">
          {pixels.map((pixel) => (
            <PixelCard key={pixel.id} pixel={pixel} onEdit={openEdit} />
          ))}
        </div>
      )}

      <PixelForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingPixel(null); }}
        editing={editingPixel}
      />
    </div>
  );
}
