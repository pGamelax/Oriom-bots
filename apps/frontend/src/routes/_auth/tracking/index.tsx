import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link2, Copy, Check, ExternalLink } from "lucide-react";
import { botsApi } from "@/lib/api";

export const Route = createFileRoute("/_auth/tracking/")({
  component: TrackingPage,
});

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function TrackingPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: bots = [], isLoading } = useQuery({
    queryKey: ["bots"],
    queryFn: botsApi.list,
  });

  const activeBots = bots.filter((b) => b.active);

  function trackingUrl(username: string) {
    return `${API_URL}/track/${username}`;
  }

  async function copyUrl(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Links de Rastreamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Use estes links como destino dos anúncios no Facebook Ads para rastrear cliques com precisão.
        </p>
      </div>

    

      {/* How to use card */}
      <div className="bg-surface rounded-2xl border border-border p-4 sm:p-5 mb-6 w-full max-w-2xl">
        <h2 className="text-sm font-semibold text-text-strong mb-3">Como configurar no Ads Manager</h2>
        <ol className="flex flex-col gap-2 text-sm text-text-label">
          <li className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
            <span>Acesse o <strong>Facebook Ads Manager</strong> e abra o conjunto de anúncios.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
            <span>Em <em>Destino</em>, selecione <strong>URL do site</strong> e cole o link correspondente ao seu bot abaixo.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
            <span>O parâmetro <code className="bg-muted px-1 rounded text-xs">fbclid</code> é adicionado automaticamente pelo Facebook a cada clique — não precisa configurar nada a mais.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
            <span>Certifique-se de ter um <strong>Pixel configurado</strong> na página de Pixels para que as conversões sejam rastreadas.</span>
          </li>
        </ol>
      </div>

      {/* Bot links */}
      <div className="w-full max-w-2xl">
        <h2 className="text-xs font-semibold text-text-label uppercase tracking-wide mb-3">
          Links por bot
        </h2>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-border animate-pulse h-20" />
            ))}
          </div>
        ) : activeBots.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border border-dashed p-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Link2 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-text-medium mb-1">Nenhum bot ativo</h3>
            <p className="text-sm text-text-muted max-w-xs">
              Ative um bot na página de Bots para visualizar o link de rastreamento.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeBots.map((bot) => {
              const url = trackingUrl(bot.username);
              return (
                <div key={bot.id} className="bg-surface rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-strong truncate">@{bot.username}</p>
                      <p className="text-xs text-text-muted truncate">{bot.name}</p>
                    </div>
                    <a
                      href={`https://t.me/${bot.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 h-7 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-text-muted hover:bg-surface-subtle transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="hidden sm:inline">Abrir bot</span>
                    </a>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 sm:p-3 rounded-xl bg-page-bg border border-border-subtle overflow-hidden">
                    <code className="flex-1 text-xs font-mono text-text-label truncate min-w-0">{url}</code>
                    <button
                      onClick={() => copyUrl(bot.id, url)}
                      title="Copiar link"
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-lilac-light hover:text-primary transition-all shrink-0"
                    >
                      {copiedId === bot.id
                        ? <Check className="w-3.5 h-3.5 text-green-600" />
                        : <Copy className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
