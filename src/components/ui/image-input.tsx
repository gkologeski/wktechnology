// Controle reutilizável de imagem/arquivo: aceita URL, upload local ou seleção da biblioteca.
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Image as ImageIcon,
  Link2,
  Upload,
  Loader2,
  Trash2,
  FolderOpen,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createMediaUploadUrl, registerMediaAsset, listMediaAssets } from "@/lib/media.functions";

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

type Props = {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  label?: string;
  placeholder?: string;
  accept?: string; // input accept
  kind?: "image" | "file";
  helperText?: string;
  buttonLabel?: string;
  /** Limite de tamanho do arquivo em bytes (padrão 20 MB). */
  maxBytes?: number;
  /** MIME types permitidos; quando omitido, aceita o que o backend permitir. */
  allowedMimes?: string[];
  /** Aviso não bloqueante de proporção: "square" ou "wide". */
  aspectHint?: "square" | "wide";
  /** Subpasta lógica no storage (ex.: "branding"). */
  folder?: "branding";
  /** Valor herdado exibido quando não há valor próprio. */
  inheritedValue?: string | null;
  /** Habilita o botão "Voltar a herdar". */
  onResetInherit?: () => void;
};

type MediaRow = {
  id: string;
  url: string;
  filename: string;
  mime: string | null;
  created_at: string;
};

function isImageMime(m?: string | null) {
  return !!m && m.startsWith("image/");
}

export function ImageInput({
  value,
  onChange,
  label,
  placeholder = "https://...",
  accept = "image/*",
  kind = "image",
  helperText,
  buttonLabel,
  maxBytes = DEFAULT_MAX_BYTES,
  allowedMimes,
  aspectHint,
  folder,
  inheritedValue,
  onResetInherit,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"upload" | "url" | "library">("upload");
  const [urlDraft, setUrlDraft] = useState(value ?? "");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) setUrlDraft(value ?? "");
  }, [open, value]);

  const createUpload = useServerFn(createMediaUploadUrl);
  const registerAsset = useServerFn(registerMediaAsset);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > maxBytes) {
        const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
        toast.error(`Arquivo acima do limite de ${mb} MB.`);
        return;
      }
      if (allowedMimes && file.type && !allowedMimes.includes(file.type.toLowerCase())) {
        toast.error("Formato não permitido para este campo.");
        return;
      }
      setUploading(true);
      try {
        const init = await createUpload({
          data: { filename: file.name, mime: file.type, size_bytes: file.size, folder },
        });
        const { error } = await supabase.storage
          .from(init.bucket)
          .uploadToSignedUrl(init.path, init.token, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (error) throw error;

        let width: number | undefined;
        let height: number | undefined;
        if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
          try {
            const dims = await readImageDims(file);
            width = dims.width;
            height = dims.height;
            const ratio = dims.width / dims.height;
            if (aspectHint === "square" && (ratio < 0.9 || ratio > 1.1)) {
              toast.warning("Imagem não é quadrada — pode ser cortada neste uso.");
            }
            if (aspectHint === "wide" && ratio > 2.5) {
              toast.warning("Imagem muito larga para um símbolo reduzido.");
            }
          } catch {
            // ignore
          }
        }

        const row = await registerAsset({
          data: {
            path: init.path,
            filename: init.filename,
            mime: file.type || undefined,
            size_bytes: file.size,
            width,
            height,
          },
        });
        onChange(row.url);
        toast.success("Arquivo enviado.");
        setOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha no upload";
        toast.error(msg);
      } finally {
        setUploading(false);
      }
    },
    [createUpload, registerAsset, onChange, maxBytes, allowedMimes, aspectHint, folder],
  );

  const hasValue = !!value;
  const previewUrl = hasValue ? value! : inheritedValue || "";

  return (
    <div className="space-y-2">
      {label ? <Label className="text-xs font-medium">{label}</Label> : null}

      <div className="flex items-start gap-3">
        <div className="h-16 w-16 shrink-0 rounded-md border border-border bg-muted/40 overflow-hidden flex items-center justify-center text-muted-foreground">
          {previewUrl &&
          (kind === "image" || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(previewUrl)) ? (
            <img src={previewUrl} alt="" className="h-full w-full object-contain" />
          ) : hasValue ? (
            <FolderOpen className="h-5 w-5" />
          ) : (
            <ImageIcon className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          {hasValue ? (
            <div className="text-xs truncate text-muted-foreground" title={value!}>
              {value}
            </div>
          ) : inheritedValue ? (
            <div className="text-xs text-muted-foreground truncate" title={inheritedValue}>
              Herdado do workspace
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Nenhum arquivo selecionado.</div>
          )}
          <div className="flex flex-wrap gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {buttonLabel ?? (hasValue ? "Substituir" : "Adicionar")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{label ?? (kind === "image" ? "Imagem" : "Arquivo")}</DialogTitle>
                </DialogHeader>
                <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="upload">
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Upload
                    </TabsTrigger>
                    <TabsTrigger value="url">
                      <Link2 className="h-3.5 w-3.5 mr-1.5" />
                      URL
                    </TabsTrigger>
                    <TabsTrigger value="library">
                      <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                      Biblioteca
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="pt-4">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleFile(f);
                      }}
                      className={`w-full rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                        dragOver ? "border-primary bg-primary/5" : "border-border"
                      }`}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enviando...
                        </div>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <div className="text-sm font-medium">Clique ou arraste um arquivo</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Até {Math.round((maxBytes / (1024 * 1024)) * 10) / 10} MB.{" "}
                            {kind === "image"
                              ? "PNG, JPG, WEBP, SVG, GIF."
                              : "Imagens, PDF, Office."}
                          </div>
                        </>
                      )}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={accept}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                        e.target.value = "";
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="url" className="pt-4 space-y-3">
                    <Label className="text-xs">URL do arquivo</Label>
                    <Input
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      placeholder={placeholder}
                      autoFocus
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const v = urlDraft.trim();
                          if (!v) {
                            toast.error("Informe uma URL.");
                            return;
                          }
                          onChange(v);
                          setOpen(false);
                        }}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="library" className="pt-4">
                    <Library
                      onPick={(row) => {
                        onChange(row.url);
                        setOpen(false);
                      }}
                      kind={kind}
                    />
                  </TabsContent>
                </Tabs>
                {helperText ? (
                  <p className="text-[11px] text-muted-foreground mt-2">{helperText}</p>
                ) : null}
              </DialogContent>
            </Dialog>

            {hasValue && onResetInherit ? (
              <Button type="button" size="sm" variant="ghost" onClick={onResetInherit}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Voltar a herdar
              </Button>
            ) : null}

            {hasValue ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(null)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Remover
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Library({ onPick, kind }: { onPick: (row: MediaRow) => void; kind: "image" | "file" }) {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const listFn = useServerFn(listMediaAssets);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listFn({ data: { q: q || undefined, kind: kind === "image" ? "image" : "all", limit: 60 } })
      .then((res) => {
        if (!cancelled) setRows(res.rows as MediaRow[]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, kind, listFn]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-9"
      />
      {loading ? (
        <div className="py-12 flex justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Nenhum arquivo encontrado. Faça upload primeiro.
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 max-h-[360px] overflow-auto">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r)}
              className="aspect-square rounded-md border border-border bg-muted/40 overflow-hidden hover:ring-2 hover:ring-primary transition-all relative group"
              title={r.filename}
            >
              {isImageMime(r.mime) ? (
                <img src={r.url} alt={r.filename} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground p-2">
                  <FolderOpen className="h-6 w-6 mb-1" />
                  <span className="text-[10px] truncate w-full text-center">{r.filename}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function readImageDims(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao ler imagem"));
    };
    img.src = url;
  });
}
