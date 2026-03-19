import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GitBranch, ImageIcon, VideoIcon, Plus, Trash2, Pencil } from "lucide-react";
import { flowsApi, type Flow } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_auth/flows/")({
  component: FlowsPage,
});

function FlowCard({ flow }: { flow: Flow }) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => flowsApi.delete(flow.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("Fluxo removido com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden hover:border-lilac hover:shadow-lg hover:shadow-primary/8 transition-all">
      {/* Media preview */}
      <div className="relative bg-muted h-36 flex items-center justify-center overflow-hidden">
        {flow.mediaUrl ? (
          flow.mediaType === "video" ? (
            <video src={flow.mediaUrl} className="w-full h-full object-cover" />
          ) : (
            <img src={flow.mediaUrl} alt="preview" className="w-full h-full object-cover" />
          )
        ) : (
          <ImageIcon className="w-10 h-10 text-text-placeholder" />
        )}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/50 text-white text-xs">
          {flow.mediaType === "video"
            ? <><VideoIcon className="w-3 h-3" /> Vídeo</>
            : <><ImageIcon className="w-3 h-3" /> Imagem</>
          }
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          {flow.name && (
            <p className="text-sm font-semibold text-text-strong mb-1 truncate">{flow.name}</p>
          )}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-lilac-light text-primary">
              @{flow.bot.username}
            </span>
            <span className="text-xs text-text-muted">
              {flow.buttons.length} {flow.buttons.length === 1 ? "botão" : "botões"}
            </span>
          </div>
          <p className="text-sm text-text-medium line-clamp-2">{flow.caption}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/flows/$flowId/edit"
            params={{ flowId: flow.id }}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium bg-lilac-light text-primary hover:bg-border transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
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
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FlowsPage() {
  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["flows"],
    queryFn: flowsApi.list,
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Fluxos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {flows.length} {flows.length === 1 ? "fluxo configurado" : "fluxos configurados"}
          </p>
        </div>
        <Link
          to="/flows/new"
          className="shrink-0 flex items-center gap-2 h-10 px-3 sm:px-4 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors shadow-md shadow-primary/25"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo fluxo</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border animate-pulse h-64" />
          ))}
        </div>
      ) : flows.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border border-dashed p-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-lilac-light flex items-center justify-center mb-4">
            <GitBranch className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-semibold text-text-medium mb-1">Nenhum fluxo ainda</h3>
          <p className="text-sm text-text-muted mb-5 max-w-xs">
            Crie um fluxo para configurar as mensagens enviadas após o /start.
          </p>
          <Link
            to="/flows/new"
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar fluxo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => (
            <FlowCard key={flow.id} flow={flow} />
          ))}
        </div>
      )}
    </div>
  );
}
