import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ChevronDown, ChevronUp, GitBranch, Loader2,
  Megaphone, Plus, ToggleLeft, ToggleRight, Trash2, PackagePlus,
} from "lucide-react";
import { flowsApi, remarketingsApi, type RemarketingPayload } from "@/lib/api";
import { MediaUpload, type MediaType } from "./media-upload";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Button {
  text: string;
  value: string;
  useDefaultDelivery: boolean;
  customDeliveryUrl: string;
}

interface VariantState {
  mediaUrl: string;
  mediaType: MediaType;
  caption: string;
  useTextMessage: boolean;
  textMessage: string;
  buttons: Button[];
}

type Audience = "all" | "new" | "pending" | "paid";

export interface RemarketingFormProps {
  mode: "create" | "edit";
  remarketingId?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const textareaClass =
  "w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none placeholder:text-text-placeholder";

const inputClass =
  "w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-placeholder";

function SectionLabel({ label, description }: { label: string; description?: string }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-semibold text-text-strong">{label}</p>
      {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
    </div>
  );
}

function emptyVariant(): VariantState {
  return {
    mediaUrl: "",
    mediaType: "image",
    caption: "",
    useTextMessage: false,
    textMessage: "",
    buttons: [{ text: "", value: "", useDefaultDelivery: true, customDeliveryUrl: "" }],
  };
}

const AUDIENCES: { value: Audience; label: string; description: string }[] = [
  { value: "new",     label: "Nunca gerou PIX",      description: "Enviado X min após o /start para leads que ainda não geraram PIX" },
  { value: "pending", label: "Gerou PIX, não pagou", description: "Enviado X min após a geração do PIX para leads que não pagaram" },
  { value: "paid",    label: "Já comprou",            description: "Enviado X min após a compra aprovada" },
  { value: "all",     label: "Todos os leads",        description: "Enviado X min após o /start para todos os leads (exceto bloqueados)" },
];

const INTERVAL_OPTIONS = [
  { label: "1 minuto",   value: 1 },
  { label: "5 minutos",  value: 5 },
  { label: "10 minutos", value: 10 },
  { label: "15 minutos", value: 15 },
  { label: "20 minutos", value: 20 },
  { label: "30 minutos", value: 30 },
  { label: "1 hora",     value: 60 },
  { label: "2 horas",    value: 120 },
  { label: "3 horas",    value: 180 },
  { label: "6 horas",    value: 360 },
  { label: "12 horas",   value: 720 },
  { label: "24 horas",   value: 1440 },
];

// ── VariantCard ────────────────────────────────────────────────────────────────

interface VariantCardProps {
  index: number;
  total: number;
  variant: VariantState;
  expanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onUpdate: (field: keyof Omit<VariantState, "buttons">, val: string | boolean) => void;
  onUpdateButton: (bi: number, field: keyof Button, val: string | boolean) => void;
  onAddButton: () => void;
  onRemoveButton: (bi: number) => void;
  flowButtons: { id: string; text: string; value: number; useDefaultDelivery: boolean; customDeliveryUrl: string | null }[];
  onImportFlowButton: (b: { id: string; text: string; value: number; useDefaultDelivery: boolean; customDeliveryUrl: string | null }) => void;
  onImportAllFlowButtons: () => void;
  flowId: string;
}

function VariantCard({
  index, total, variant, expanded, onToggleExpand, onRemove,
  onUpdate, onUpdateButton, onAddButton, onRemoveButton,
  flowButtons, onImportFlowButton, onImportAllFlowButtons, flowId,
}: VariantCardProps) {
  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 px-4 sm:px-5 py-4 cursor-pointer hover:bg-surface-subtle transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-xs font-bold shrink-0">
            {index + 1}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-strong">Variante {index + 1}</p>
            {!expanded && (
              <p className="text-xs text-text-muted truncate max-w-[180px] sm:max-w-xs">
                {variant.caption.trim() || variant.textMessage.trim() || "Sem mensagem configurada"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {total > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 rounded-lg text-text-muted hover:bg-red-50 hover:text-destructive transition-all"
              title="Remover variante"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-text-muted" />
            : <ChevronDown className="w-4 h-4 text-text-muted" />
          }
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-border">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* Left: media + caption + text message */}
            <div className="flex flex-col gap-4">
              {/* Media */}
              <div className="bg-surface-subtle rounded-xl border border-border p-3 sm:p-4">
                <SectionLabel label="Mídia" description="Imagem ou vídeo. Opcional." />
                <MediaUpload
                  value={variant.mediaUrl}
                  mediaType={variant.mediaType}
                  onChange={(url, type) => { onUpdate("mediaUrl", url); onUpdate("mediaType", type); }}
                  onClear={() => onUpdate("mediaUrl", "")}
                />
              </div>

              {/* Caption */}
              <div className="bg-surface-subtle rounded-xl border border-border p-3 sm:p-4">
                <SectionLabel label="Caption" description="Texto exibido junto à mídia." />
                <textarea
                  value={variant.caption}
                  onChange={(e) => onUpdate("caption", e.target.value)}
                  placeholder="Olá! Ainda tem interesse? Confira nossos planos 👇"
                  rows={4}
                  className={textareaClass}
                />
              </div>

              {/* Separate text message */}
              <div className="bg-surface-subtle rounded-xl border border-border p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3 mb-0">
                  <SectionLabel
                    label="Mensagem separada para os botões"
                    description={variant.useTextMessage
                      ? "Os botões serão enviados nesta mensagem."
                      : "Os botões serão enviados junto ao caption da mídia."
                    }
                  />
                  <button
                    type="button"
                    onClick={() => onUpdate("useTextMessage", !variant.useTextMessage)}
                    className="shrink-0 mb-3"
                  >
                    {variant.useTextMessage
                      ? <ToggleRight className="w-9 h-9 text-primary" />
                      : <ToggleLeft className="w-9 h-9 text-text-placeholder" />
                    }
                  </button>
                </div>
                <div className={cn(
                  "overflow-hidden transition-all duration-300",
                  variant.useTextMessage ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
                )}>
                  <textarea
                    value={variant.textMessage}
                    onChange={(e) => onUpdate("textMessage", e.target.value)}
                    placeholder="Escolha um plano:"
                    rows={3}
                    className={textareaClass}
                  />
                </div>
              </div>
            </div>

            {/* Right: buttons */}
            <div className="flex flex-col gap-4">
              {/* Buttons list */}
              <div className="bg-surface-subtle rounded-xl border border-border p-3 sm:p-4">
                <SectionLabel
                  label="Planos desta variante"
                  description="Botões enviados nesta variante."
                />
                <div className="flex flex-col gap-3">
                  {variant.buttons.map((btn, bi) => (
                    <div
                      key={bi}
                      className="rounded-xl border border-border bg-background p-3 flex flex-col gap-2"
                    >
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="flex items-center justify-center shrink-0 w-7 h-7 rounded-full bg-lilac-light">
                            <span className="text-xs font-bold text-primary">{bi + 1}</span>
                          </div>
                          <input
                            type="text"
                            value={btn.text}
                            onChange={(e) => onUpdateButton(bi, "text", e.target.value)}
                            placeholder="Nome do plano"
                            className={cn(inputClass, "flex-1 min-w-0")}
                          />
                          <button
                            type="button"
                            onClick={() => onRemoveButton(bi)}
                            disabled={variant.buttons.length === 1}
                            className="sm:hidden h-10 w-10 flex items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 pl-9 sm:pl-0">
                          <div className="relative flex-1 sm:flex-none sm:w-28 shrink-0">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary pointer-events-none">
                              R$
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={btn.value}
                              onChange={(e) => onUpdateButton(bi, "value", e.target.value)}
                              placeholder="0,00"
                              className={cn(
                                inputClass,
                                "pl-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              )}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveButton(bi)}
                            disabled={variant.buttons.length === 1}
                            className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="pl-0 sm:pl-9 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateButton(bi, "useDefaultDelivery", !btn.useDefaultDelivery)}
                          className="flex items-center gap-2 self-start"
                        >
                          {btn.useDefaultDelivery
                            ? <ToggleRight className="w-7 h-7 text-primary" />
                            : <ToggleLeft className="w-7 h-7 text-text-placeholder" />
                          }
                          <span className="text-xs font-medium text-text-label">Usar entrega padrão</span>
                        </button>
                        {!btn.useDefaultDelivery && (
                          <input
                            type="url"
                            value={btn.customDeliveryUrl}
                            onChange={(e) => onUpdateButton(bi, "customDeliveryUrl", e.target.value)}
                            placeholder="https://seu-link-de-entrega.com"
                            className={inputClass}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onAddButton}
                  className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar plano
                </button>
              </div>

              {/* Flow buttons reference */}
              {flowId && (
                <div className="bg-surface-subtle rounded-xl border border-border p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <SectionLabel label="Planos do fluxo" description="Clique em + para importar." />
                    {flowButtons.length > 0 && (
                      <button
                        type="button"
                        onClick={onImportAllFlowButtons}
                        className="shrink-0 h-8 px-3 rounded-lg text-xs font-medium border border-border text-text-label hover:border-border-medium transition-colors whitespace-nowrap"
                      >
                        Adicionar todos
                      </button>
                    )}
                  </div>
                  {flowButtons.length === 0 ? (
                    <p className="text-xs text-text-muted">Este fluxo não tem planos cadastrados.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {flowButtons.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-background border border-border"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{b.text}</p>
                            <p className="text-xs text-text-muted">R$ {b.value.toFixed(2).replace(".", ",")}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onImportFlowButton(b)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-lilac-light transition-colors shrink-0"
                          >
                            <PackagePlus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RemarketingForm({ mode, remarketingId }: RemarketingFormProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: flows = [], isSuccess: flowsLoaded } = useQuery({
    queryKey: ["flows"],
    queryFn: flowsApi.list,
  });

  const { data: remarketing, isLoading: loadingRemarketing } = useQuery({
    queryKey: ["remarketings", remarketingId],
    queryFn: () => remarketingsApi.list().then((list) => list.find((r) => r.id === remarketingId)),
    enabled: mode === "edit" && !!remarketingId,
  });

  // ── State ──────────────────────────────────────────────────────────────────

  const [name, setName] = useState("");
  const [flowId, setFlowId] = useState("");
  const [targetAudience, setTargetAudience] = useState<Audience>("pending");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [startAfterMinutes, setStartAfterMinutes] = useState(20);
  const [defaultDeliveryUrl, setDefaultDeliveryUrl] = useState("");
  const [variants, setVariants] = useState<VariantState[]>([emptyVariant()]);
  const [expandedVariant, setExpandedVariant] = useState(0);

  const selectReady = mode === "create"
    ? flowsLoaded
    : flowsLoaded && !!remarketing;

  // ── Populate on edit ───────────────────────────────────────────────────────

  useEffect(() => {
    if (remarketing) {
      setName(remarketing.name);
      setFlowId(remarketing.flowId);
      setTargetAudience(remarketing.targetAudience);
      setIntervalMinutes(remarketing.intervalMinutes);
      setStartAfterMinutes(remarketing.startAfterMinutes);
      setDefaultDeliveryUrl(remarketing.defaultDeliveryUrl ?? "");
      setVariants(
        remarketing.variants.length > 0
          ? remarketing.variants.map((v) => ({
              mediaUrl: v.mediaUrl ?? "",
              mediaType: (v.mediaType as MediaType) ?? "image",
              caption: v.caption ?? "",
              useTextMessage: v.useTextMessage,
              textMessage: v.textMessage ?? "",
              buttons: v.buttons.length > 0
                ? v.buttons.map((b) => ({
                    text: b.text,
                    value: String(b.value),
                    useDefaultDelivery: b.useDefaultDelivery,
                    customDeliveryUrl: b.customDeliveryUrl ?? "",
                  }))
                : [{ text: "", value: "", useDefaultDelivery: true, customDeliveryUrl: "" }],
            }))
          : [emptyVariant()]
      );
    }
  }, [remarketing]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: remarketingsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["remarketings"] });
      toast.success("Remarketing criado!");
      navigate({ to: "/remarketings" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: RemarketingPayload) => remarketingsApi.update(remarketingId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["remarketings"] });
      toast.success("Alterações salvas!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Flow buttons ───────────────────────────────────────────────────────────

  const selectedFlow = flows.find((f) => f.id === flowId);
  const flowButtons = selectedFlow?.buttons ?? [];

  // ── Variant helpers ────────────────────────────────────────────────────────

  function addVariant() {
    setVariants((prev) => [...prev, emptyVariant()]);
    setExpandedVariant(variants.length); // expand the new one
  }

  function removeVariant(vi: number) {
    setVariants((prev) => prev.filter((_, i) => i !== vi));
    setExpandedVariant(Math.max(0, expandedVariant >= vi ? expandedVariant - 1 : expandedVariant));
  }

  function updateVariant(vi: number, field: keyof Omit<VariantState, "buttons">, val: string | boolean) {
    setVariants((prev) => prev.map((v, i) => i === vi ? { ...v, [field]: val } : v));
  }

  function addVariantButton(vi: number) {
    setVariants((prev) => prev.map((v, i) =>
      i === vi
        ? { ...v, buttons: [...v.buttons, { text: "", value: "", useDefaultDelivery: true, customDeliveryUrl: "" }] }
        : v
    ));
  }

  function removeVariantButton(vi: number, bi: number) {
    setVariants((prev) => prev.map((v, i) =>
      i === vi ? { ...v, buttons: v.buttons.filter((_, idx) => idx !== bi) } : v
    ));
  }

  function updateVariantButton(vi: number, bi: number, field: keyof Button, val: string | boolean) {
    setVariants((prev) => prev.map((v, i) =>
      i === vi
        ? { ...v, buttons: v.buttons.map((b, idx) => idx === bi ? { ...b, [field]: val } : b) }
        : v
    ));
  }

  function addFlowButtonToVariant(vi: number, b: { text: string; value: number; useDefaultDelivery: boolean; customDeliveryUrl: string | null }) {
    setVariants((prev) => prev.map((v, i) =>
      i === vi
        ? {
            ...v,
            buttons: [
              ...v.buttons.filter((x) => x.text !== "" || x.value !== ""),
              { text: b.text, value: String(b.value), useDefaultDelivery: b.useDefaultDelivery, customDeliveryUrl: b.customDeliveryUrl ?? "" },
            ],
          }
        : v
    ));
  }

  function importAllFlowButtonsToVariant(vi: number) {
    if (!flowButtons.length) { toast.error("O fluxo não tem planos cadastrados."); return; }
    setVariants((prev) => prev.map((v, i) =>
      i === vi
        ? {
            ...v,
            buttons: flowButtons.map((b) => ({
              text: b.text,
              value: String(b.value),
              useDefaultDelivery: b.useDefaultDelivery,
              customDeliveryUrl: b.customDeliveryUrl ?? "",
            })),
          }
        : v
    ));
    toast.success("Planos importados para a variante!");
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Informe o nome do remarketing na aba Geral."); return; }
    if (!flowId)       { toast.error("Selecione um fluxo na aba Geral."); return; }
    if (variants.length === 0) { toast.error("Adicione pelo menos uma variante."); return; }

    const anyUsesDefault = variants.some((v) =>
      v.buttons.some((b) => b.useDefaultDelivery && b.text.trim() && b.value !== "")
    );
    if (anyUsesDefault && !defaultDeliveryUrl.trim()) {
      toast.error("Informe o link de entrega padrão na aba Geral.");
      return;
    }

    const payload: RemarketingPayload = {
      flowId,
      name: name.trim(),
      targetAudience,
      intervalMinutes,
      startAfterMinutes,
      defaultDeliveryUrl: defaultDeliveryUrl.trim() || undefined,
      variants: variants.map((v) => {
        const validButtons = v.buttons.filter((b) => b.text.trim() && b.value !== "");
        return {
          mediaUrl: v.mediaUrl || undefined,
          mediaType: v.mediaUrl ? v.mediaType : undefined,
          caption: v.caption.trim() || undefined,
          useTextMessage: v.useTextMessage,
          textMessage: v.useTextMessage ? v.textMessage.trim() || undefined : undefined,
          buttons: validButtons.map((b, i) => ({
            text: b.text.trim(),
            value: parseFloat(b.value),
            order: i,
            useDefaultDelivery: b.useDefaultDelivery,
            customDeliveryUrl: b.useDefaultDelivery ? undefined : b.customDeliveryUrl.trim() || undefined,
          })),
        };
      }),
    };

    if (mode === "create") createMutation.mutate(payload);
    else updateMutation.mutate(payload);
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (mode === "edit" && loadingRemarketing) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Check if any button across all variants uses default delivery
  const anyUsesDefault = variants.some((v) =>
    v.buttons.some((b) => b.useDefaultDelivery && b.text.trim() && b.value !== "")
  );
  const missingDefaultUrl = anyUsesDefault && !defaultDeliveryUrl.trim();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/remarketings"
            className="p-2 rounded-lg hover:bg-lilac-light transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-text-label" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
              {mode === "create" ? "Novo remarketing" : "Editar remarketing"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">
              Configure mensagens automáticas para reengajar seus leads
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <Link
            to="/remarketings"
            className="h-10 px-4 rounded-lg text-sm font-medium text-text-label hover:bg-muted transition-colors inline-flex items-center"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            form="remarketing-form"
            disabled={isPending}
            className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-md shadow-primary/25"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? "Salvando..." : mode === "create" ? "Criar remarketing" : "Salvar"}
          </button>
        </div>
      </div>

      <form id="remarketing-form" onSubmit={handleSubmit}>
        <Tabs defaultValue="geral">
          <TabsList className="flex w-full sm:inline-flex sm:w-auto">
            <TabsTrigger value="geral" className="flex-1 sm:flex-none px-2 sm:px-4">
              <Megaphone className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="variantes" className="flex-1 sm:flex-none px-2 sm:px-4">
              <GitBranch className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Variantes</span>
              <span className="ml-1.5 text-xs font-bold bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                {variants.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* ── GERAL ── */}
          <TabsContent value="geral">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Left column */}
              <div className="flex flex-col gap-4">
                <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                  <SectionLabel
                    label="Nome do remarketing"
                    description="Identificador interno para organizar seus remarketings."
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Recuperação de carrinho"
                    className={inputClass}
                  />
                </div>

                <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                  <SectionLabel
                    label="Fluxo associado"
                    description="O remarketing usará os gateways e pixels configurados neste fluxo."
                  />
                  {selectReady ? (
                    <Select value={flowId} onValueChange={setFlowId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um fluxo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {flows.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            @{f.bot.username} — {f.name ?? f.caption.slice(0, 40)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 rounded-lg border border-border bg-surface-subtle animate-pulse" />
                  )}
                  {flowsLoaded && flows.length === 0 && (
                    <p className="text-xs text-text-muted mt-2">
                      Nenhum fluxo cadastrado.{" "}
                      <Link to="/flows/new" className="text-primary underline">Criar fluxo</Link>
                    </p>
                  )}
                </div>

                <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                  <SectionLabel
                    label="Começar a enviar após"
                    description="Tempo mínimo desde a ação do lead para ele ser elegível."
                  />
                  <Select
                    value={String(startAfterMinutes)}
                    onValueChange={(v) => setStartAfterMinutes(Number(v))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTERVAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                  <SectionLabel
                    label="Repetir a cada"
                    description="Com qual frequência o remarketing dispara para leads elegíveis."
                  />
                  <Select
                    value={String(intervalMinutes)}
                    onValueChange={(v) => setIntervalMinutes(Number(v))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTERVAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Default delivery URL */}
                <div className={cn(
                  "bg-surface rounded-2xl border p-4 sm:p-6 transition-colors",
                  missingDefaultUrl ? "border-[oklch(65%_0.18_25)]" : "border-border"
                )}>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-text-strong">
                      Entrega padrão
                      {anyUsesDefault && <span className="ml-1 text-destructive">*</span>}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Link enviado após o pagamento para planos sem link próprio.
                    </p>
                  </div>
                  <input
                    type="url"
                    value={defaultDeliveryUrl}
                    onChange={(e) => setDefaultDeliveryUrl(e.target.value)}
                    placeholder="https://seu-link-de-entrega.com"
                    className={cn(
                      inputClass,
                      missingDefaultUrl && "border-[oklch(65%_0.18_25)] focus:border-destructive focus:ring-destructive/20"
                    )}
                  />
                  {missingDefaultUrl && (
                    <p className="text-xs text-destructive mt-2">
                      Obrigatório — um ou mais planos usam a entrega padrão.
                    </p>
                  )}
                </div>
              </div>

              {/* Right: audience */}
              <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                <SectionLabel
                  label="Audiência"
                  description="Para quais leads este remarketing será enviado."
                />
                <div className="flex flex-col gap-2">
                  {AUDIENCES.map(({ value, label, description }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTargetAudience(value)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl border transition-all",
                        targetAudience === value
                          ? "border-primary bg-lilac-light"
                          : "border-border bg-surface-subtle hover:border-border-medium"
                      )}
                    >
                      <p className={cn(
                        "text-sm font-medium",
                        targetAudience === value ? "text-primary" : "text-text-strong"
                      )}>
                        {label}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">{description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── VARIANTES ── */}
          <TabsContent value="variantes">
            <div className="flex flex-col gap-3">
              {variants.length > 1 && (
                <div className="bg-lilac-light border border-primary/20 rounded-xl px-4 py-3">
                  <p className="text-sm text-primary font-medium">
                    Rotação ativa — {variants.length} variantes serão enviadas em sequência (1 → 2 → ... → {variants.length} → 1)
                  </p>
                </div>
              )}

              {variants.map((variant, vi) => (
                <VariantCard
                  key={vi}
                  index={vi}
                  total={variants.length}
                  variant={variant}
                  expanded={expandedVariant === vi}
                  onToggleExpand={() => setExpandedVariant(expandedVariant === vi ? -1 : vi)}
                  onRemove={() => removeVariant(vi)}
                  onUpdate={(field, val) => updateVariant(vi, field, val)}
                  onUpdateButton={(bi, field, val) => updateVariantButton(vi, bi, field, val)}
                  onAddButton={() => addVariantButton(vi)}
                  onRemoveButton={(bi) => removeVariantButton(vi, bi)}
                  flowButtons={flowButtons}
                  onImportFlowButton={(b) => addFlowButtonToVariant(vi, b)}
                  onImportAllFlowButtons={() => importAllFlowButtonsToVariant(vi)}
                  flowId={flowId}
                />
              ))}

              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors mt-1"
              >
                <Plus className="w-4 h-4" />
                Adicionar variante
              </button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions mobile */}
        <div className="flex sm:hidden items-center justify-end gap-3 mt-4 pb-8">
          <Link
            to="/remarketings"
            className="h-10 px-4 rounded-lg text-sm font-medium text-text-label hover:bg-muted transition-colors inline-flex items-center"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-md shadow-primary/25"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? "Salvando..." : mode === "create" ? "Criar remarketing" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
