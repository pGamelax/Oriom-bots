import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Bot, GitBranch, Loader2, Plus, Trash2,
  ToggleLeft, ToggleRight, Layers, QrCode,
} from "lucide-react";
import { botsApi, flowsApi, type FlowPayload } from "@/lib/api";
import { MediaUpload, type MediaType } from "./media-upload";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Button {
  text: string;
  value: string;
  useDefaultDelivery: boolean;
  customDeliveryUrl: string;
}

interface FlowFormProps {
  mode: "create" | "edit";
  flowId?: string;
}

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

export function FlowForm({ mode, flowId }: FlowFormProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: bots = [], isSuccess: botsLoaded } = useQuery({
    queryKey: ["bots"],
    queryFn: botsApi.list,
  });

  const { data: flow, isLoading: loadingFlow, isSuccess: flowLoaded } = useQuery({
    queryKey: ["flows", flowId],
    queryFn: () => flowsApi.get(flowId!),
    enabled: mode === "edit" && !!flowId,
  });

  const [flowName, setFlowName] = useState("");
  const [botId, setBotId] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [caption, setCaption] = useState("");
  const [useTextMessage, setUseTextMessage] = useState(false);
  const [textMessage, setTextMessage] = useState("");
  const [defaultDeliveryUrl, setDefaultDeliveryUrl] = useState("");
  const [pixQrCaption, setPixQrCaption] = useState("");
  const [pixHowToPay, setPixHowToPay] = useState("");
  const [pixCopyLabel, setPixCopyLabel] = useState("");
  const [pixAfterLabel, setPixAfterLabel] = useState("");
  const [buttons, setButtons] = useState<Button[]>([
    { text: "", value: "", useDefaultDelivery: true, customDeliveryUrl: "" },
  ]);

  // No modo edit, aguarda até o useEffect ter populado botId com o valor real
  // Assim o Select monta uma única vez já com o valor correto, sem flash vazio
  const selectReady = mode === "create"
    ? botsLoaded
    : (botsLoaded && flowLoaded && botId !== "");

  useEffect(() => {
    if (flow) {
      setFlowName(flow.name ?? "");
      setBotId(flow.botId);
      setMediaUrl(flow.mediaUrl);
      setMediaType(flow.mediaType);
      setCaption(flow.caption);
      setUseTextMessage(flow.useTextMessage);
      setTextMessage(flow.textMessage ?? "");
      setDefaultDeliveryUrl(flow.defaultDeliveryUrl ?? "");
      setPixQrCaption(flow.pixQrCaption ?? "");
      setPixHowToPay(flow.pixHowToPay ?? "");
      setPixCopyLabel(flow.pixCopyLabel ?? "");
      setPixAfterLabel(flow.pixAfterLabel ?? "");
      setButtons(
        flow.buttons.length > 0
          ? flow.buttons.map((b) => ({
              text: b.text,
              value: String(b.value),
              useDefaultDelivery: b.useDefaultDelivery,
              customDeliveryUrl: b.customDeliveryUrl ?? "",
            }))
          : [{ text: "", value: "", useDefaultDelivery: true, customDeliveryUrl: "" }]
      );
    }
  }, [flow]);

  const createMutation = useMutation({
    mutationFn: flowsApi.create,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Fluxo criado!");
      // Redireciona para o edit do fluxo recém-criado
      navigate({ to: "/flows/$flowId/edit", params: { flowId: created.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: FlowPayload) => flowsApi.update(flowId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows", flowId] });
      toast.success("Alterações salvas!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Inclui o bot atual do fluxo mesmo que já tenha flow associado
  const availableBots = bots.filter((b) => !b.flow || b.id === flow?.botId || b.id === botId);

  function addButton() {
    setButtons((prev) => [
      ...prev,
      { text: "", value: "", useDefaultDelivery: true, customDeliveryUrl: "" },
    ]);
  }

  function removeButton(i: number) {
    setButtons((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateButton(i: number, field: keyof Button, val: string | boolean) {
    setButtons((prev) => prev.map((b, idx) => (idx === i ? { ...b, [field]: val } : b)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!botId) { toast.error("Selecione um bot na aba Bot."); return; }
    if (!mediaUrl) { toast.error("Faça o upload de uma mídia na aba Boas-vindas."); return; }
    if (!caption.trim()) { toast.error("Insira o caption na aba Boas-vindas."); return; }

    const validButtons = buttons.filter((b) => b.text.trim() && b.value !== "");

    const anyUsesDefault = validButtons.some((b) => b.useDefaultDelivery);
    if (anyUsesDefault && !defaultDeliveryUrl.trim()) {
      toast.error("Informe o link de entrega padrão na aba Planos.");
      return;
    }

    const payload: FlowPayload = {
      botId,
      name: flowName.trim() || undefined,
      mediaUrl,
      mediaType,
      caption: caption.trim(),
      useTextMessage,
      textMessage: useTextMessage ? textMessage.trim() : undefined,
      defaultDeliveryUrl: defaultDeliveryUrl.trim() || undefined,
      pixQrCaption: pixQrCaption.trim() || undefined,
      pixHowToPay: pixHowToPay.trim() || undefined,
      pixCopyLabel: pixCopyLabel.trim() || undefined,
      pixAfterLabel: pixAfterLabel.trim() || undefined,
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

  if (mode === "edit" && loadingFlow) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/flows"
            className="p-2 rounded-lg hover:bg-lilac-light transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-text-label" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
              {mode === "create" ? "Novo fluxo" : "Editar fluxo"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">
              Configure as mensagens enviadas após o /start
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <Link
            to="/flows"
            className="h-10 px-4 rounded-lg text-sm font-medium text-text-label hover:bg-muted transition-colors inline-flex items-center"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            form="flow-form"
            disabled={isPending}
            className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-md shadow-primary/25"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? "Salvando..." : mode === "create" ? "Criar fluxo" : "Salvar"}
          </button>
        </div>
      </div>

      <form id="flow-form" onSubmit={handleSubmit}>
        <Tabs defaultValue="bot">
          <TabsList className="flex w-full sm:inline-flex sm:w-auto">
            <TabsTrigger value="bot" className="flex-1 sm:flex-none px-2 sm:px-4">
              <Bot className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Bot</span>
            </TabsTrigger>
            <TabsTrigger value="boas-vindas" className="flex-1 sm:flex-none px-2 sm:px-4">
              <GitBranch className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Boas-vindas</span>
            </TabsTrigger>
            <TabsTrigger value="planos" className="flex-1 sm:flex-none px-2 sm:px-4">
              <Layers className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Planos</span>
            </TabsTrigger>
            <TabsTrigger value="pix" className="flex-1 sm:flex-none px-2 sm:px-4">
              <QrCode className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">PIX</span>
            </TabsTrigger>
          </TabsList>

          {/* ── BOT ── */}
          <TabsContent value="bot">
            <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6 w-full max-w-lg flex flex-col gap-5">
              <div>
                <SectionLabel
                  label="Nome do fluxo"
                  description="Identificador interno para organizar seus fluxos."
                />
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="Ex: Fluxo de vendas principal"
                  className={inputClass}
                />
              </div>
              <div>
              <SectionLabel
                label="Bot associado"
                description="Cada bot pode ser associado a apenas um fluxo."
              />
              {selectReady ? (
                <Select value={botId} onValueChange={setBotId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um bot..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBots.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        @{b.username} — {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-10 rounded-lg border border-border bg-surface-subtle animate-pulse" />
              )}
              {selectReady && botsLoaded && bots.length > 0 && availableBots.length === 0 && (
                <p className="text-xs text-destructive mt-2">
                  Todos os bots já estão associados a um fluxo.
                </p>
              )}
              {botsLoaded && bots.length === 0 && (
                <p className="text-xs text-text-muted mt-2">
                  Nenhum bot cadastrado.{" "}
                  <Link to="/bots/new" className="text-primary underline">
                    Criar bot
                  </Link>
                </p>
              )}
              </div>
            </div>
          </TabsContent>

          {/* ── BOAS-VINDAS ── */}
          <TabsContent value="boas-vindas">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Mídia */}
              <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                <SectionLabel
                  label="Mídia do /start"
                  description="Imagem ou vídeo enviado quando o usuário acessa o bot."
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
                <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                  <SectionLabel
                    label="Caption"
                    description="Texto exibido junto à mídia."
                  />
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Olá! Confira nossos planos abaixo 👇"
                    rows={5}
                    className={textareaClass}
                  />
                </div>

                <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
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
              {/* Buttons column */}
              <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                <SectionLabel
                  label="Planos de pagamento"
                  description="Cada botão representa um plano. O valor será usado para gerar o PIX."
                />

                <div className="flex flex-col gap-3">
                  {buttons.map((btn, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-surface-subtle p-3 flex flex-col gap-2"
                    >
                      {/* Name + value + remove */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        {/* Row 1 (mobile) / full row (desktop): badge + name + [value sm+] + delete */}
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
                        {/* Row 2 (mobile) / inline (desktop): price + delete */}
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

                      {/* Delivery toggle */}
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
                          <span className="text-xs font-medium text-text-label">
                            Usar entrega padrão
                          </span>
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

              {/* Default delivery card */}
              {(() => {
                const anyUsesDefault = buttons.some((b) => b.useDefaultDelivery);
                const missing = anyUsesDefault && !defaultDeliveryUrl.trim();
                return (
                  <div className={cn(
                    "bg-surface rounded-2xl border p-4 sm:p-6 transition-colors",
                    missing
                      ? "border-[oklch(65%_0.18_25)]"
                      : "border-border"
                  )}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-text-strong">
                          Entrega padrão
                          {anyUsesDefault && (
                            <span className="ml-1 text-destructive">*</span>
                          )}
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
          </TabsContent>
          {/* ── PIX ── */}
          <TabsContent value="pix">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <div className="flex flex-col gap-4">
                {/* QR Caption */}
                <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                  <SectionLabel
                    label="Legenda do QR Code"
                    description="Texto exibido junto à imagem do QR Code."
                  />
                  <input
                    type="text"
                    value={pixQrCaption}
                    onChange={(e) => setPixQrCaption(e.target.value)}
                    placeholder="Escaneie o QR Code para pagar"
                    className={inputClass}
                  />
                </div>

                {/* Copy label */}
                <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                  <SectionLabel
                    label="Label do código PIX"
                    description="Texto exibido antes do código copia e cola."
                  />
                  <input
                    type="text"
                    value={pixCopyLabel}
                    onChange={(e) => setPixCopyLabel(e.target.value)}
                    placeholder="Copie o código abaixo:"
                    className={inputClass}
                  />
                </div>

                {/* After label */}
                <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                  <SectionLabel
                    label="Mensagem dos botões de ação"
                    description="Texto acima dos botões Verificar Status / Copiar Código / Ver QR Code."
                  />
                  <input
                    type="text"
                    value={pixAfterLabel}
                    onChange={(e) => setPixAfterLabel(e.target.value)}
                    placeholder="Após efetuar o pagamento, clique no botão abaixo 🔄"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* How to pay */}
              <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6">
                <SectionLabel
                  label="Instruções de pagamento"
                  description="Mensagem enviada ao usuário ensinando como pagar via PIX. Suporta HTML do Telegram (<b>, <i>, <code>)."
                />
                <textarea
                  value={pixHowToPay}
                  onChange={(e) => setPixHowToPay(e.target.value)}
                  placeholder={
                    `✅ <b>Como realizar o pagamento:</b>\n\n` +
                    `1. Abra o aplicativo do seu banco.\n` +
                    `2. Selecione a opção "Pagar" ou "PIX".\n` +
                    `3. Escolha "PIX Copia e Cola".\n` +
                    `4. Cole a chave que está abaixo e finalize o pagamento com segurança.`
                  }
                  rows={10}
                  className={textareaClass}
                />
                <p className="text-xs text-text-muted mt-2">
                  Deixe em branco para usar o texto padrão.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions mobile */}
        <div className="flex sm:hidden items-center justify-end gap-3 mt-4 pb-8">
          <Link
            to="/flows"
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
            {isPending ? "Salvando..." : mode === "create" ? "Criar fluxo" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
