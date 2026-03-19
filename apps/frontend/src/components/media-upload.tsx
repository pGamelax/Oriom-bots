import { useRef, useState } from "react";
import { Upload, X, ImageIcon, VideoIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

export type MediaType = "image" | "video";

interface MediaUploadProps {
  value?: string;
  mediaType?: MediaType;
  onChange: (url: string, type: MediaType) => void;
  onClear: () => void;
}

async function uploadToCloudinary(file: File): Promise<{ url: string; type: MediaType }> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Configure VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env");
  }

  const resourceType = file.type.startsWith("video/") ? "video" : "image";
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Erro ao fazer upload");
  }

  const data = await res.json();
  return { url: data.secure_url as string, type: resourceType as MediaType };
}

export function MediaUpload({ value, mediaType, onChange, onClear }: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/quicktime"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG, GIF, WEBP, MP4 ou MOV.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 50MB.");
      return;
    }

    setUploading(true);
    try {
      const { url, type } = await uploadToCloudinary(file);
      onChange(url, type);
      toast.success("Upload concluído!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  if (value) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border bg-surface-subtle">
        {mediaType === "video" ? (
          <video
            src={value}
            className="w-full max-h-56 object-contain"
            controls
          />
        ) : (
          <img
            src={value}
            alt="Preview"
            className="w-full max-h-56 object-contain"
          />
        )}
        <button
          type="button"
          onClick={onClear}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/50 text-white text-xs">
          {mediaType === "video"
            ? <><VideoIcon className="w-3 h-3" /> Vídeo</>
            : <><ImageIcon className="w-3 h-3" /> Imagem</>
          }
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-xl p-5 sm:p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
        dragOver
          ? "border-primary bg-lilac-light"
          : "border-border bg-surface-subtle hover:border-border-medium hover:bg-surface-raised",
        uploading && "pointer-events-none opacity-60"
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {uploading ? (
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-lilac-light flex items-center justify-center">
          <Upload className="w-5 h-5 text-primary" />
        </div>
      )}

      <div className="text-center">
        <p className="text-sm font-medium text-text-medium">
          {uploading ? "Enviando..." : "Clique ou arraste o arquivo"}
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          Imagem (JPG, PNG, GIF, WEBP) ou Vídeo (MP4, MOV) · Máx. 50MB
        </p>
      </div>
    </div>
  );
}
