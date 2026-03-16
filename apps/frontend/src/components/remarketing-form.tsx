import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, GitBranch, Layers, Loader2, Megaphone, Plus,
  ToggleLeft, ToggleRight, Trash2, PackagePlus,
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
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [caption, setCaption] = useState("");
  const [useTextMessage, setUseTextMessage] = useState(false);
  const [textMessage, setTextMessage] = useState("");
  const [defaultDeliveryUrl, setDefaultDeliveryUrl] = useState("");
  const [buttons, setButtons] = useState<Button[]>([
    { text: "", value: "", useDefaultDelivery: true, customDeliveryUrl: "" },
  ]);

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
      setMediaUrl(remarketing.mediaUrl ?? "");
      setMediaType((remarketing.mediaType as MediaType) ?? "image");
      setCaption(remarketing.caption ?? "");
      setUseTextMessage(remarketing.useTextMessage);
      setTextMessage(remarketing.textMessage ?? "");
      setDefaultDeliveryUrl(remarketing.defaultDeliveryUrl ?? "");
      setButtons(
        remarketing.buttons.length > 0
          ? remarketing.buttons.map((b) => ({
              text: b.text,
              value: String(b.value),
              useDefaultDelivery: b.useDefaultDelivery,
              customDeliveryUrl: b.customDeliveryUrl ?? "",
            }))
          : [{ text: "", value: "", useDefaultDelivery: true, customDeliveryUrl: "" }]
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

  // ── Flow buttons (for import) ──────────────────────────────────────────────

  const selectedFlow = flows.find((f) => f.id === flowId);
  const flowButtons = selectedFlow?.buttons ?? [];

  function addFlowButton(b: typeof flowButtons[0]) {
    setButtons((prev) => [
      ...prev.filter((x) => x.text !== "" || x.value !== ""), // remove empty placeholder
      { text: b.text, value: String(b.value), useDefaultDelivery: b.useDefaultDelivery, customDeliveryUrl: b.customDeliveryUrl ?? "" },
    ]);
  }

  function importAllFlowButtons() {
    if (!flowButtons.length) { toast.error("O fluxo não tem planos cadastrados."); return; }
    setButtons(flowButtons.map((b) => ({
      text: b.text,
      value: String(b.value),
      useDefaultDelivery: b.useDefaultDelivery,
      customDeliveryUrl: b.customDeliveryUrl ?? "",
    })));
    toast.success("Todos os planos importados!");
  }

  // ── Button helpers ─────────────────────────────────────────────────────────

  function addButton() {
    setButtons((p) => [...p, { text: "", value: "", useDefaultDelivery: true, customDeliveryUrl: "" }]);
  }

  function removeButton(i: number) {
    setButtons((p) => p.filter((_, idx) => idx !== i));
  }

  function updateButton(i: number, field: keyof Button, val: string | boolean) {
    setButtons((p) => p.map((b, idx) => (idx === i ? { ...b, [field]: val } : b)));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())   { toast.error("Informe o nome do remarketing na aba Geral."); return; }
    if (!flowId)         { toast.error("Selecione um fluxo na aba Geral."); return; }

    const validButtons = buttons.filter((b) => b.text.trim() && b.value !== "");
    const anyUsesDefault = validButtons.some((b) => b.useDefaultDelivery);
    if (anyUsesDefault && !defaultDeliveryUrl.trim()) {
      toast.error("Informe o link de entrega padrão na aba Planos.");
      return;
    }

    const payload: RemarketingPayload = {
      flowId,
      name: name.trim(),
      targetAudience,
      intervalMinutes,
      startAfterMinutes,
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaUrl ? mediaType : undefined,
      caption: caption.trim() || undefined,
      useTextMessage,
      textMessage: useTextMessage ? textMessage.trim() || undefined : undefined,
      defaultDeliveryUrl: defaultDeliveryUrl.trim() || undefined,
      buttons: validButtons.map((b, i) => ({
        text: b.text.trim(),
        value: parseFloat(b.value),
        order: i,
        useDefaultDelivery: b.useDefaultDelivery,
        customDeliveryUrl: b.useDefaultDelivery ? undefined : b.customDeliveryUrl.trim() || undefined,
      })),
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/remarketings"
            className="p-2 rounded-lg hover:bg-lilac-light transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-text-label" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {mode === "create" ? "Novo remarketing" : "Editar remarketing"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
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
            <TabsTrigger value="mensagem" className="flex-1 sm:flex-none px-2 sm:px-4">
              <GitBranch className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Mensagem</span>
            </TabsTrigger>
            <TabsTrigger value="planos" className="flex-1 sm:flex-none px-2 sm:px-4">
              <Layers className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Planos</span>
            </TabsTrigger>
          </TabsList>

          {/* ── GERAL ── */}
          <TabsContent value="geral">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Left: name + flow */}
              <div className="flex flex-col gap-4">
                <div className="bg-surface rounded-2xl border border-border p-6">
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

                <div className="bg-surface rounded-2xl border border-border p-6">
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

                <div className="bg-surface rounded-2xl border border-border p-6">
                  <SectionLabel
                    label="Começar a enviar após"
                    description="Tempo mínimo desde a ação do lead (início, PIX gerado ou compra) para ele ser elegível."
                  />
                  <Select
                    value={String(startAfterMinutes)}
                    onValueChange={(v) => setStartAfterMinutes(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-surface rounded-2xl border border-border p-6">
                  <SectionLabel
                    label="Repetir a cada"
                    description="Com qual frequência o remarketing dispara para leads elegíveis."
                  />
                  <Select
                    value={String(intervalMinutes)}
                    onValueChange={(v) => setIntervalMinutes(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVAL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right: audience */}
              <div className="bg-surface rounded-2xl border border-border p-6">
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

          {/* ── MENSAGEM ── */}
          <TabsContent value="mensagem">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Mídia */}
              <div className="bg-surface rounded-2xl border border-border p-6">
                <SectionLabel
                  label="Mídia da mensagem"
                  description="Imagem ou vídeo enviado com o remarketing. Opcional."
                />
                <MediaUpload
                  value={mediaUrl}
                  mediaType={mediaType}
                  onChange={(url, type) => { setMediaUrl(url); setMediaType(type); }}
                  onClear={() => setMediaUrl("")}
                />
              </div>

              {/* Caption + texto separado */}
              <div className="flex flex-col gap-4">
                <div className="bg-surface rounded-2xl border border-border p-6">
                  <SectionLabel
                    label="Caption"
                    description="Texto exibido junto à mídia."
                  />
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Olá! Ainda tem interesse? Confira nossos planos 👇"
                    rows={5}
                    className={textareaClass}
                  />
                </div>

                <div className="bg-surface rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between gap-3 mb-0">
                    <SectionLabel
                      label="Mensagem separada para os botões"
                      description={
                        useTextMessage
                          ? "Os botões serão enviados nesta mensagem."
                          : "Os botões serão enviados junto ao caption da mídia."
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setUseTextMessage((v) => !v)}
                      className="shrink-0 mb-3"
                    >
                      {useTextMessage
                        ? <ToggleRight className="w-9 h-9 text-primary" />
                        : <ToggleLeft className="w-9 h-9 text-text-placeholder" />
                      }
                    </button>
                  </div>

                  <div className={cn(
                    "overflow-hidden transition-all duration-300",
                    useTextMessage ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
                  )}>
                    <textarea
                      value={textMessage}
                      onChange={(e) => setTextMessage(e.target.value)}
                      placeholder="Escolha um plano:"
                      rows={3}
                      className={textareaClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── PLANOS ── */}
          <TabsContent value="planos">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Buttons */}
              <div className="bg-surface rounded-2xl border border-border p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <SectionLabel
                    label="Planos do remarketing"
                    description="Planos que serão enviados neste remarketing. Adicione do fluxo ou crie novos."
                  />
                </div>

                <div className="flex flex-col gap-3">
                  {buttons.map((btn, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-surface-subtle p-3 flex flex-col gap-2"
                    >
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="flex items-center justify-center shrink-0 w-7 h-7 rounded-full bg-lilac-light">
                            <span className="text-xs font-bold text-primary">{i + 1}</span>
                          </div>
                          <input
                            type="text"
                            value={btn.text}
                            onChange={(e) => updateButton(i, "text", e.target.value)}
                            placeholder="Nome do plano"
                            className={cn(inputClass, "flex-1 min-w-0")}
                          />
                          <button
                            type="button"
                            onClick={() => removeButton(i)}
                            disabled={buttons.length === 1}
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
                              onChange={(e) => updateButton(i, "value", e.target.value)}
                              placeholder="0,00"
                              className={cn(
                                inputClass,
                                "pl-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              )}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeButton(i)}
                            disabled={buttons.length === 1}
                            className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="pl-0 sm:pl-9 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => updateButton(i, "useDefaultDelivery", !btn.useDefaultDelivery)}
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
                            onChange={(e) => updateButton(i, "customDeliveryUrl", e.target.value)}
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
                  onClick={addButton}
                  className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar plano
                </button>
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-4">

                {/* Flow plans reference */}
                {flowId && (
                  <div className="bg-surface rounded-2xl border border-border p-6">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <SectionLabel
                        label="Planos do fluxo"
                        description="Clique em + para adicionar ao remarketing."
                      />
                      {flowButtons.length > 0 && (
                        <button
                          type="button"
                          onClick={importAllFlowButtons}
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
                            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-surface-subtle border border-border"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{b.text}</p>
                              <p className="text-xs text-text-muted">
                                R$ {b.value.toFixed(2).replace(".", ",")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addFlowButton(b)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-lilac-light transition-colors shrink-0"
                              title="Adicionar ao remarketing"
                            >
                              <PackagePlus className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!flowId && (
                  <div className="bg-surface rounded-2xl border border-dashed border-border p-6 flex flex-col items-center text-center">
                    <PackagePlus className="w-8 h-8 text-text-muted mb-2 opacity-40" />
                    <p className="text-sm text-text-muted">
                      Selecione um fluxo na aba <strong>Geral</strong> para ver e importar seus planos.
                    </p>
                  </div>
                )}

                {/* Default delivery */}
                {(() => {
                  const anyUsesDefault = buttons.some((b) => b.useDefaultDelivery);
                  const missing = anyUsesDefault && !defaultDeliveryUrl.trim();
                  return (
                    <div className={cn(
                      "bg-surface rounded-2xl border p-6 transition-colors",
                      missing ? "border-[oklch(65%_0.18_25)]" : "border-border"
                    )}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-sm font-semibold text-text-strong">
                            Entrega padrão
                            {anyUsesDefault && <span className="ml-1 text-destructive">*</span>}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5">
                            Link enviado automaticamente após o pagamento ser aprovado.
                          </p>
                        </div>
                      </div>
                      <input
                        type="url"
                        value={defaultDeliveryUrl}
                        onChange={(e) => setDefaultDeliveryUrl(e.target.value)}
                        placeholder="https://seu-link-de-entrega.com"
                        className={cn(
                          inputClass,
                          missing && "border-[oklch(65%_0.18_25)] focus:border-destructive focus:ring-destructive/20"
                        )}
                      />
                      {missing ? (
                        <p className="text-xs text-destructive mt-2">
                          Obrigatório — um ou mais planos usam a entrega padrão.
                        </p>
                      ) : (
                        <p className="text-xs text-text-muted mt-2">
                          Planos sem link próprio usarão este link.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
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
