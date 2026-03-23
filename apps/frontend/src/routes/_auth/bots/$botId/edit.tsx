import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, CheckCircle2, Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { botsApi } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_auth/bots/$botId/edit")({
  component: EditBotPage,
});

interface TelegramBotInfo {
  id: number;
  first_name: string;
  username: string;
  is_bot: boolean;
}

async function fetchBotInfo(token: string): Promise<TelegramBotInfo> {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = await res.json();
  if (!data.ok) throw new Error("Token inválido. Verifique e tente novamente.");
  return data.result as TelegramBotInfo;
}

function EditBotPage() {
  const { botId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: bot, isLoading } = useQuery({
    queryKey: ["bots", botId],
    queryFn: () => botsApi.get(botId),
  });

  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [cloakSafeUrl, setCloakSafeUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [tokenVerified, setTokenVerified] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preenche o formulário com os dados atuais do bot
  useEffect(() => {
    if (bot) {
      setToken(bot.token);
      setName(bot.name);
      setUsername(bot.username);
      setCloakSafeUrl(bot.cloakSafeUrl ?? "");
      setTokenVerified(true);
    }
  }, [bot]);

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; username: string; token: string; cloakSafeUrl?: string }) =>
      botsApi.update(botId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bots"] });
      toast.success("Bot atualizado com sucesso!");
      navigate({ to: "/bots" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleTokenChange(value: string) {
    setToken(value);
    setTokenVerified(false);

    // Se o token não mudou em relação ao original, mantém os dados
    if (bot && value.trim() === bot.token) {
      setName(bot.name);
      setUsername(bot.username);
      setTokenVerified(true);
      return;
    }

    setName("");
    setUsername("");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (!trimmed || !trimmed.includes(":") || trimmed.length < 20) return;

    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const info = await fetchBotInfo(trimmed);
        setName(info.first_name);
        setUsername(info.username);
        setTokenVerified(true);
        toast.success(`Bot @${info.username} verificado!`);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Token inválido");
      } finally {
        setFetching(false);
      }
    }, 800);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenVerified) {
      toast.error("Verifique o token antes de salvar.");
      return;
    }
    updateMutation.mutate({ name, username, token: token.trim(), cloakSafeUrl: cloakSafeUrl.trim() || undefined });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <Link
          to="/bots"
          className="p-2 rounded-lg hover:bg-lilac-light transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-text-label" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
            Editar bot
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {bot ? `@${bot.username}` : "Carregando..."}
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="w-full max-w-lg bg-surface rounded-2xl border border-border shadow-xl shadow-primary/8 overflow-hidden">
        {/* Token section */}
        <div className="p-4 sm:p-6 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-lilac-light flex items-center justify-center">
              <KeyRound className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-text-strong">
              Token do bot
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={token}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder="1234567890:ABCDEFGabcdefghijklmnopqrstuvwxyz"
              className={cn(
                "w-full h-11 pl-3 pr-10 rounded-lg border text-sm font-mono outline-none transition-all placeholder:text-text-placeholder placeholder:font-sans",
                tokenVerified
                  ? "border-[oklch(60%_0.18_150)]  focus:ring-2 focus:ring-[oklch(60%_0.18_150)]/20"
                  : "border-border bg-background focus:border-primary focus:ring-2 focus:ring-primary/20",
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {fetching && (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              )}
              {!fetching && tokenVerified && (
                <CheckCircle2 className="w-4 h-4 text-[oklch(55%_0.18_150)]" />
              )}
            </div>
          </div>

          <p className="text-xs text-text-muted mt-2">
            Altere o token e ele será verificado automaticamente
          </p>
        </div>

        {/* Bot info section */}
        <div
          className={cn(
            "transition-all duration-300 overflow-hidden",
            tokenVerified ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="p-4 sm:p-6 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-lilac-light flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-text-strong">
                Informações do bot
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-label">
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-label">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                    @
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-10 pl-6 pr-3 w-full rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cloaker section */}
        <div className="p-4 sm:p-6 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-lilac-light flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-text-strong">
              Cloaker de anúncio
            </span>
          </div>
          <p className="text-xs text-text-muted mb-3">
            Se o visitante não veio de um anúncio do Facebook/Instagram, ele será redirecionado para esta URL no lugar do bot.
            Deixe em branco para desativar.
          </p>
          <input
            type="url"
            value={cloakSafeUrl}
            onChange={(e) => setCloakSafeUrl(e.target.value)}
            placeholder="https://seusite.com/pagina-segura"
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-placeholder"
          />
        </div>

        {/* Actions */}
        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-6 flex items-center justify-end gap-3"
        >
          <Link
            to="/bots"
            className="h-10 px-4 rounded-lg text-sm font-medium text-text-label hover:bg-muted transition-colors inline-flex items-center"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={!tokenVerified || updateMutation.isPending}
            className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {updateMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      </div>
    </div>
  );
}
