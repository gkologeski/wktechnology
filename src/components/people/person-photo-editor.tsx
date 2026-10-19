import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PersonAvatar } from "@/components/people/person-avatar";
import { usePersonPhotos } from "@/hooks/use-person-photos";
import { setPersonPhoto } from "@/lib/people/person-photo.functions";
import {
  PERSON_PHOTO_MAX_BYTES,
  PERSON_PHOTO_TYPES,
  type PersonEntity,
} from "@/lib/people/person-photo";

const OUTPUT_PX = 256;

async function fileToPhotoDataUrl(file: File): Promise<string> {
  if (!(PERSON_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("Formato não suportado. Use PNG, JPG, WEBP ou GIF.");
  }
  if (file.size > 8 * PERSON_PHOTO_MAX_BYTES) throw new Error("O arquivo é grande demais.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight) || OUTPUT_PX;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(OUTPUT_PX, side);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a imagem.");
    // Recorte quadrado central.
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Avatar grande da ficha com Enviar/Trocar/Remover foto (confirmação antes de gravar). */
export function PersonPhotoEditor({
  entity,
  id,
  name,
  hasPhoto,
  photoSource,
  onChanged,
}: {
  entity: PersonEntity;
  id: string;
  name: string;
  hasPhoto: boolean;
  photoSource?: string | null;
  onChanged?: () => void;
}) {
  const photos = usePersonPhotos(entity === "contact" ? [id] : [], entity === "lead" ? [id] : []);
  const url = photos[`${entity}:${id}`];
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ dataUrl: string | null } | null>(null);
  const qc = useQueryClient();
  const save = useServerFn(setPersonPhoto);
  const m = useMutation({
    mutationFn: (dataUrl: string | null) => save({ data: { entity, id, dataUrl } }),
    onSuccess: async (_r, dataUrl) => {
      toast.success(dataUrl ? "Foto atualizada" : "Foto removida");
      await qc.invalidateQueries({ queryKey: ["person-photos"] });
      onChanged?.();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPending(null),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Foto do perfil"
          disabled={m.isPending}
        >
          <PersonAvatar
            name={name}
            seed={id}
            photoUrl={url}
            className="h-16 w-16 border-4 border-card text-xl font-bold shadow-lg"
          />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-foreground/50 text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera className="h-5 w-5" aria-hidden />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => input.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> {hasPhoto ? "Trocar foto" : "Enviar foto"}
          </DropdownMenuItem>
          {hasPhoto && (
            <DropdownMenuItem onSelect={() => setPending({ dataUrl: null })}>
              <Trash2 className="mr-2 h-4 w-4" /> Remover foto
            </DropdownMenuItem>
          )}
          {photoSource === "linkedin" && (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">Foto obtida do LinkedIn</p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={input}
        type="file"
        accept={PERSON_PHOTO_TYPES.join(",")}
        className="hidden"
        aria-label="Selecionar foto"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            setPending({ dataUrl: await fileToPhotoDataUrl(file) });
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      />
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !m.isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.dataUrl ? "Salvar nova foto?" : "Remover a foto?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              A foto aparece em todas as telas onde {name} é exibido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending?.dataUrl && (
            <img
              src={pending.dataUrl}
              alt="Pré-visualização"
              className="mx-auto h-24 w-24 rounded-full object-cover"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={m.isPending}
              onClick={(e) => {
                e.preventDefault();
                m.mutate(pending?.dataUrl ?? null);
              }}
            >
              {m.isPending ? "Salvando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
