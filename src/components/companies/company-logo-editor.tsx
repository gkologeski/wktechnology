import { useRef, useState } from "react";
import { ImageUp, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompanyAvatar } from "./company-avatar";
import {
  LOGO_ACCEPT,
  fileToLogoDataUrl,
  useCompanyLogoActions,
} from "@/hooks/use-company-logo-actions";

type Company = {
  id: string;
  name: string;
  logo_url?: string | null;
  logo_source?: string | null;
  domain?: string | null;
  website?: string | null;
};

const errMsg = (e: unknown) => (e as { message?: string })?.message ?? "Falha ao salvar o logotipo.";

export function CompanyLogoEditor({
  company,
  canEdit,
  onChanged,
}: {
  company: Company;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { save, find } = useCompanyLogoActions(company.id, onChanged);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState(company.name);

  const avatar = (
    <CompanyAvatar
      name={company.name}
      seed={company.id}
      logoUrl={company.logo_url}
      logoSource={company.logo_source}
      domain={company.domain}
      website={company.website}
      size="xl"
    />
  );
  if (!canEdit) return avatar;

  const apply = (patch: Parameters<typeof save.mutate>[0], ok: string) =>
    save.mutate(patch, {
      onSuccess: () => {
        toast.success(ok);
        setPreview(null);
        setSearchOpen(false);
      },
      onError: (e) => toast.error(errMsg(e)),
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Alterar logotipo da empresa"
          >
            {avatar}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            <ImageUp className="mr-2 h-4 w-4" /> Enviar logotipo
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setQuery(company.name);
              find.reset();
              setSearchOpen(true);
            }}
          >
            <Search className="mr-2 h-4 w-4" /> Encontrar logotipo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              apply({ logo_url: null, logo_source: "auto" }, "Usando logotipo automático")
            }
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Usar logotipo automático
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => apply({ logo_url: null, logo_source: "none" }, "Logotipo removido")}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileRef}
        type="file"
        accept={LOGO_ACCEPT}
        className="sr-only"
        aria-label="Arquivo de logotipo"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            setPreview(await fileToLogoDataUrl(file));
          } catch (err) {
            toast.error(errMsg(err));
          }
        }}
      />

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar logotipo</DialogTitle>
            <DialogDescription>Confira a prévia antes de salvar.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            {preview && (
              <img
                src={preview}
                alt="Prévia do logotipo"
                className="h-24 w-24 rounded-lg border border-border bg-card object-contain p-1"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancelar
            </Button>
            <Button
              disabled={save.isPending}
              onClick={() =>
                preview && apply({ logo_url: preview, logo_source: "manual" }, "Logotipo salvo")
              }
            >
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Encontrar logotipo</DialogTitle>
            <DialogDescription>
              Busque pelo nome da marca e escolha a opção certa. Nada é salvo sem sua escolha.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim().length >= 2) find.mutate(query.trim());
            }}
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="logo-search">Nome da marca</Label>
              <Input id="logo-search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Button type="submit" disabled={find.isPending || query.trim().length < 2}>
              {find.isPending ? "Buscando…" : "Buscar"}
            </Button>
          </form>
          <div aria-live="polite" className="min-h-16 space-y-1">
            {find.isError && <p className="text-sm text-destructive">{errMsg(find.error)}</p>}
            {find.isSuccess && find.data.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma marca encontrada. Tente outro nome ou envie o logotipo.
              </p>
            )}
            {find.data?.map((s) => (
              <button
                key={s.domain}
                type="button"
                disabled={save.isPending}
                className="flex w-full items-center gap-3 rounded-md border border-border/60 p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() =>
                  apply(
                    {
                      logo_url: null,
                      logo_source: "auto",
                      domain: s.domain,
                      ...(company.website ? {} : { website: `https://${s.domain}` }),
                    },
                    `Logotipo de ${s.name} aplicado`,
                  )
                }
              >
                <CompanyAvatar name={s.name} seed={s.domain} domain={s.domain} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.domain}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
