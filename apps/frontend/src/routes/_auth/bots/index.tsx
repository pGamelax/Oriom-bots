import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, BotOff, Plus, Trash2, Power, Pencil } from "lucide-react";
import { botsApi, type Bot as BotType } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_auth/bots/")({
  component: BotsPage,
});

function BotCard({ bot }: { bot: BotType }) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => botsApi.delete(bot.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bots"] });
      toast.success("Bot removido com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: () => botsApi.toggle(bot.id),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["bots"] });
      toast.success(updated.active ? "Bot ativado!" : "Bot desativado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-4 hover:border-lilac hover:shadow-lg hover:shadow-primary/8 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-lilac-light flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{bot.name}</h3>
            <p className="text-sm text-text-muted truncate">@{bot.username}</p>
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 text-xs font-medium px-2.5 py-1 rounded-full",
            bot.active
              ? "bg-primary text-on-primary"
              : "bg-muted text-text-muted"
          )}
        >
          {bot.active ? "Ativo" : "Inativo"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-all disabled:opacity-50",
            bot.active
              ? "bg-muted text-text-label hover:bg-border-subtle"
              : "bg-lilac-light text-primary hover:bg-border"
          )}
        >
          {bot.active ? (
            <><BotOff className="w-3.5 h-3.5" /> Desativar</>
          ) : (
            <><Power className="w-3.5 h-3.5" /> Ativar</>
          )}
        </button>

        <Link
          to="/bots/$botId/edit"
          params={{ botId: bot.id }}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-lilac-light hover:text-primary transition-all"
          title="Editar bot"
        >
          <Pencil className="w-4 h-4" />
        </Link>

        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setConfirmDelete(false)}
              className="h-8 px-3 rounded-lg text-xs font-medium bg-muted text-text-label hover:bg-border-subtle transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="h-8 px-3 rounded-lg text-xs font-medium bg-destructive text-white hover:bg-[oklch(48%_0.22_25)] disabled:opacity-50 transition-all"
            >
              {deleteMutation.isPending ? "..." : "Confirmar"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-destructive transition-all"
            title="Excluir bot"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function BotsPage() {
  const { data: bots = [], isLoading } = useQuery({
    queryKey: ["bots"],
    queryFn: botsApi.list,
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Meus Bots</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {bots.length} {bots.length === 1 ? "bot registrado" : "bots registrados"}
          </p>
        </div>
        <Link
          to="/bots/new"
          className="shrink-0 flex items-center gap-2 h-10 px-3 sm:px-4 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors shadow-md shadow-primary/25"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo bot</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border border-dashed p-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-lilac-light flex items-center justify-center mb-4">
            <Bot className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-semibold text-text-medium mb-1">Nenhum bot ainda</h3>
          <p className="text-sm text-text-muted mb-5 max-w-xs">
            Adicione seu primeiro bot do Telegram para começar.
          </p>
          <Link
            to="/bots/new"
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar bot
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}
