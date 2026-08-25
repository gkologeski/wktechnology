import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, Trash2, Copy, Image as ImageIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  createMediaUploadUrl,
  registerMediaAsset,
  listMediaAssets,
  deleteMediaAsset,
} from "@/lib/media.functions";

export const Route = createFileRoute("/_authenticated/settings/media")({
  component: MediaLibraryPage,
  head: () => ({
    meta: [{ title: "Biblioteca de mídia" }],
  }),
});

type MediaRow = {
  id: string;
  url: string;
  filename: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

const MAX_BYTES = 20 * 1024 * 1024;

function fmt(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function MediaLibraryPage() {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const listFn = useServerFn(listMediaAssets);
  const createUpload = useServerFn(createMediaUploadUrl);
  const registerAsset = useServerFn(registerMediaAsset);
  const delFn = useServerFn(deleteMediaAsset);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await listFn({ data: { q: q || undefined, kind: "all", limit: 100 } });
      setRows(res.rows as MediaRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > MAX_BYTES) {
          toast.error(`${f.name}: acima de 20 MB`);
          continue;
        }
        const init = await createUpload({
          data: { filename: f.name, mime: f.type, size_bytes: f.size },
        });
        const { error } = await supabase.storage
          .from(init.bucket)
          .uploadToSignedUrl(init.path, init.token, f, {
            contentType: f.type || "application/octet-stream",
          });
        if (error) {
          toast.error(`${f.name}: ${error.message}`);
          continue;
        }
        await registerAsset({
          data: {
            path: init.path,
            filename: init.filename,
            mime: f.type || undefined,
            size_bytes: f.size,
          },
        });
      }
      toast.success("Upload concluído");
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("URL copiada");
  };

  const remove = async (id: string) => {
    if (!(await confirmDialog("Excluir este arquivo?"))) return;
    try {
      await delFn({ data: { id } });
      setRows((r) => r.filter((x) => x.id !== id));
      toast.success("Removido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Biblioteca de mídia</h1>
          <p className="text-sm text-muted-foreground">
            Imagens, PDFs e documentos compartilhados pelo workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Enviar arquivos
          </Button>
        </div>
      </header>

      <Input
        placeholder="Buscar por nome..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <div className="py-16 flex justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
          Nenhum arquivo ainda. Clique em "Enviar arquivos" para começar.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {rows.map((r) => {
            const isImg = r.mime?.startsWith("image/");
            return (
              <div key={r.id} className="border rounded-lg overflow-hidden bg-card group">
                <div className="aspect-square bg-muted/40 flex items-center justify-center">
                  {isImg ? (
                    <img src={r.url} alt={r.filename} className="h-full w-full object-cover" />
                  ) : (
                    <FileText className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <div className="text-xs font-medium truncate" title={r.filename}>
                    {r.filename}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{fmt(r.size_bytes)}</div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 flex-1"
                      onClick={() => copy(r.url)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      URL
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <ImageIcon className="h-3 w-3" />
        Limite de 20 MB por arquivo. Tipos permitidos: imagens, PDF, Office.
      </p>
    </div>
  );
}
