import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CreditCard, Plus, GripVertical, Trash2, Pencil,
  Globe, GitBranch, X, Loader2, Eye, EyeOff, Info,
} from "lucide-react";
import { gatewaysApi, flowsApi, type Gateway, type GatewayPayload } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_auth/gateways/")({
  component: GatewaysPage,
});

const inputClass =
  "w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-placeholder";

/* ── Slide-in Form Panel ── */
function GatewayForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Gateway | null;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
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
        setApiKey(editing.apiKey);
        setApiSecret(editing.apiSecret);
        setScope(editing.scope as "global" | "specific");
        setSelectedFlows(editing.flows.map((f) => f.flowId));
      } else {
        setName("");
        setApiKey("");
        setApiSecret("");
        setShowKey(false);
        setShowSecret(false);
        setScope("global");
        setSelectedFlows([]);
      }
    }
  }, [editing, open]);

  const createMutation = useMutation({
    mutationFn: gatewaysApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gateways"] });
      toast.success("Gateway criado!");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: GatewayPayload) => gatewaysApi.update(editing!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gateways"] });
      toast.success("Gateway atualizado!");
      onClose();
    },
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
    if (!name.trim()) { toast.error("Informe um nome para o gateway."); return; }
    if (!apiKey.trim()) { toast.error("Informe o Client ID."); return; }
    if (!apiSecret.trim()) { toast.error("Informe o Client Secret."); return; }
    if (scope === "specific" && selectedFlows.length === 0) {
      toast.error("Selecione ao menos um fluxo.");
      return;
    }

    const payload: GatewayPayload = {
      name: name.trim(),
      type: "syncpay",
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      scope,
      flowIds: scope === "specific" ? selectedFlows : undefined,
    };

    if (editing) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface shadow-2xl flex flex-col transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {editing ? "Editar gateway" : "Novo gateway"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Gateway type */}
          <div>
            <label className="text-xs font-semibold text-text-label uppercase tracking-wide mb-1.5 block">
              Gateway
            </label>
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-page-bg">
              <div className="w-8 h-8 rounded-lg bg-lilac-light flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-strong">SyncPay</p>
                <p className="text-xs text-text-muted">Gateway PIX</p>
              </div>
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
              placeholder="Ex: Conta Principal, Backup..."
              className={inputClass}
            />
          </div>

          {/* Client ID + Client Secret */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-text-label uppercase tracking-wide mb-1.5 block">
                Client ID
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Seu Client ID da SyncPay"
                  className={cn(inputClass, "pr-10")}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-medium transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-label uppercase tracking-wide mb-1.5 block">
                Client Secret
              </label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Seu Client Secret da SyncPay"
                  className={cn(inputClass, "pr-10")}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-medium transition-colors"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
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
                  {s === "global"
                    ? <Globe className="w-4 h-4" />
                    : <GitBranch className="w-4 h-4" />
                  }
                  {s === "global" ? "Global" : "Específico"}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-1.5">
              {scope === "global"
                ? "Usado em todos os fluxos que não tenham um gateway específico."
                : "Usado apenas nos fluxos selecionados abaixo."}
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
                        <p className="text-xs text-text-muted truncate">{flow.caption}</p>
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
            className="h-10 w-full rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-md shadow-primary/25"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? "Salvando..." : editing ? "Salvar alterações" : "Criar gateway"}
          </button>
        </form>
      </div>
    </>
  );
}

/* ── Sortable Gateway Card ── */
function GatewayCard({
  gateway,
  index,
  onEdit,
}: {
  gateway: Gateway;
  index: number;
  onEdit: (g: Gateway) => void;
}) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: gateway.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const toggleMutation = useMutation({
    mutationFn: () => gatewaysApi.toggle(gateway.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gateways"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => gatewaysApi.delete(gateway.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gateways"] });
      toast.success("Gateway removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-surface rounded-2xl border p-4 flex items-center gap-3 transition-all",
        isDragging
          ? "shadow-xl shadow-primary/15 border-lilac"
          : "border-border"
      )}
    >
      {/* Order indicator + drag handle */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <span className="text-[10px] font-bold text-text-label">{index + 1}</span>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-text-label hover:text-text-label touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-lilac-light flex items-center justify-center shrink-0">
        <CreditCard className="w-4 h-4 text-primary" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text-strong">{gateway.name}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-lilac-light text-primary">
            SyncPay
          </span>
          {!gateway.active && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-text-muted">
              Inativo
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-text-muted">
          {gateway.scope === "global" ? (
            <>
              <Globe className="w-3 h-3" />
              <span>Global</span>
            </>
          ) : (
            <>
              <GitBranch className="w-3 h-3" />
              <span>{gateway.flows.length} {gateway.flows.length === 1 ? "fluxo" : "fluxos"}</span>
            </>
          )}
        </div>
      </div>

      {/* Active toggle */}
      <button
        onClick={() => toggleMutation.mutate()}
        disabled={toggleMutation.isPending}
        title={gateway.active ? "Desativar" : "Ativar"}
        className="shrink-0 disabled:opacity-50"
      >
        <div className={cn(
          "w-11 h-6 rounded-full relative transition-colors duration-200",
          gateway.active ? "bg-primary" : "bg-border"
        )}>
          <div className={cn(
            "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200",
            gateway.active ? "left-6" : "left-1"
          )} />
        </div>
      </button>

      {/* Edit */}
      <button
        onClick={() => onEdit(gateway)}
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
          className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-destructive transition-all shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Page ── */
function GatewaysPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null);
  const [items, setItems] = useState<Gateway[]>([]);

  const { data: gateways = [], isLoading } = useQuery({
    queryKey: ["gateways"],
    queryFn: gatewaysApi.list,
  });

  useEffect(() => {
    setItems(gateways);
  }, [gateways]);

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => gatewaysApi.reorder(ids),
    onError: (e: Error) => {
      toast.error(e.message);
      setItems(gateways);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((g) => g.id === active.id);
      const newIndex = prev.findIndex((g) => g.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      reorderMutation.mutate(reordered.map((g) => g.id));
      return reordered;
    });
  }

  function openCreate() {
    setEditingGateway(null);
    setFormOpen(true);
  }

  function openEdit(gateway: Gateway) {
    setEditingGateway(gateway);
    setFormOpen(true);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gateways de Pagamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? "gateway configurado" : "gateways configurados"}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors shadow-md shadow-primary/25"
        >
          <Plus className="w-4 h-4" />
          Adicionar gateway
        </button>
      </div>

      {/* Info banner */}
      {items.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-lilac-light border border-border mb-6">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-text-medium">
            O <strong>primeiro gateway ativo</strong> da lista será usado ao processar um pagamento.
            Se falhar, o próximo será tentado. Se não houver substituto, será feita uma nova tentativa
            antes de retornar erro ao usuário. Arraste para reordenar.
          </p>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border animate-pulse h-20" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border border-dashed p-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-lilac-light flex items-center justify-center mb-4">
            <CreditCard className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-semibold text-text-medium mb-1">Nenhum gateway configurado</h3>
          <p className="text-sm text-text-muted mb-5 max-w-xs">
            Adicione um gateway de pagamento para gerar cobranças PIX nos seus fluxos.
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar gateway
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3 max-w-2xl">
              {items.map((gateway, index) => (
                <GatewayCard
                  key={gateway.id}
                  gateway={gateway}
                  index={index}
                  onEdit={openEdit}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <GatewayForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingGateway(null); }}
        editing={editingGateway}
      />
    </div>
  );
}
