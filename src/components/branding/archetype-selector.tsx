import { Check, LayoutTemplate, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  BRAND_ARCHETYPES,
  type BrandArchetype,
  type BrandArchetypeId,
} from "@/lib/branding/archetypes";

type Props = {
  activeId: BrandArchetypeId | null;
  selectedId: BrandArchetypeId | null;
  onSelect: (archetype: BrandArchetype) => void;
  onApply: (archetype: BrandArchetype) => void;
};

function ArchetypeMiniature({ archetype }: { archetype: BrandArchetype }) {
  const colors = archetype.theme.light;
  return (
    <div
      className="h-28 overflow-hidden border"
      style={{
        background: colors["product-canvas"],
        borderColor: colors["product-divider"],
        borderRadius: archetype.style.radius,
      }}
      aria-hidden="true"
    >
      <div className="flex h-full">
        <div className="w-12 border-r p-2" style={{ background: colors.sidebar, borderColor: colors.border }}>
          <div className="mb-3 h-4 w-4" style={{ background: colors.primary, borderRadius: archetype.style.radius }} />
          {[0, 1, 2].map((item) => (
            <div key={item} className="mb-2 h-1.5 w-full" style={{ background: item === 0 ? colors.accent : colors["product-divider"], borderRadius: archetype.style.radius }} />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="h-7 border-b px-2 py-1.5" style={{ background: colors["product-header"], borderColor: colors["product-divider"] }}>
            <div className="h-1.5 w-16" style={{ background: colors.foreground, borderRadius: archetype.style.radius }} />
          </div>
          <div className="space-y-2 p-2">
            <div className="flex gap-1.5">
              <div className="h-6 flex-1 border" style={{ background: colors["product-panel"], borderColor: colors["product-divider"], borderRadius: archetype.style.radius }} />
              <div className="h-6 flex-1 border" style={{ background: colors["product-panel-muted"], borderColor: colors["product-divider"], borderRadius: archetype.style.radius }} />
            </div>
            <div className="border" style={{ background: colors.card, borderColor: colors["product-divider"], borderRadius: archetype.style.radius }}>
              <div className="h-3 border-b" style={{ background: colors["product-toolbar"], borderColor: colors["product-divider"] }} />
              <div className="flex items-center justify-between p-1.5">
                <div className="h-1.5 w-12" style={{ background: colors["muted-foreground"] }} />
                <div className="h-3 w-8" style={{ background: colors.success, borderRadius: archetype.style.radius }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArchetypeSelector({ activeId, selectedId, onSelect, onApply }: Props) {
  const selected = BRAND_ARCHETYPES.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="space-y-5 p-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LayoutTemplate className="h-4 w-4" /> Modelos visuais
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Escolha uma base completa e confira o resultado na prévia antes de aplicar.
        </p>
      </div>

      <div className="space-y-3" role="radiogroup" aria-label="Modelos visuais">
        {BRAND_ARCHETYPES.map((archetype) => {
          const isSelected = archetype.id === selectedId;
          const isActive = archetype.id === activeId;
          return (
            <Button
              key={archetype.id}
              type="button"
              variant="outline"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(archetype)}
              className={`h-auto w-full whitespace-normal p-2 text-left transition-shadow ${isSelected ? "border-primary ring-2 ring-primary/30" : ""}`}
            >
              <span className="block w-full space-y-3">
                <ArchetypeMiniature archetype={archetype} />
                <span className="flex items-start justify-between gap-2 px-1">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{archetype.name}</span>
                    <span className="mt-1 block text-[11px] font-normal leading-4 text-muted-foreground">{archetype.description}</span>
                  </span>
                  {(isActive || isSelected) && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                </span>
                <span className="block px-1 text-[10px] font-medium text-muted-foreground">
                  {isActive ? "Modelo atual" : archetype.recommendedFor}
                </span>
              </span>
            </Button>
          );
        })}
      </div>

      {!activeId && !selectedId && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          O estilo atual é personalizado. Selecione um modelo para compará-lo.
        </p>
      )}

      <AlertDialog>
        <Button asChild disabled={!selected || selected.id === activeId} className="w-full">
          <AlertDialogTrigger>
            <Sparkles className="h-4 w-4" /> Aplicar modelo
          </AlertDialogTrigger>
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar {selected?.name ?? "este modelo"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Cores, fontes, densidade, cantos e ícones atuais serão substituídos. Nome, logos,
              imagens, domínio e contatos serão preservados. A mudança só será definitiva após salvar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => selected && onApply(selected)}>Aplicar modelo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}