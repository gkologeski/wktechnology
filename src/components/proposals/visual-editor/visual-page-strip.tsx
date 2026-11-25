import { ChevronLeft, ChevronRight, Copy, Layers, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/access-control/use-permissions";
import type { VisualDesign } from "@/lib/proposals/visual-design";
import type { EditorMode } from "./visual-editor-state";

type VisualPageStripProps = {
  design: VisualDesign;
  pageIndex: number;
  mode: EditorMode;
  editable: boolean;
  onSelectPage: (index: number) => void;
  onToggleMaster: () => void;
  onAddPage: () => void;
  onDuplicatePage: (index: number) => void;
  onMovePage: (from: number, to: number) => void;
  onDeletePage: (index: number) => void;
};

export function VisualPageStrip({
  design,
  pageIndex,
  mode,
  editable: editableProp,
  onSelectPage,
  onToggleMaster,
  onAddPage,
  onDuplicatePage,
  onMovePage,
  onDeletePage,
}: VisualPageStripProps) {
  const { can } = usePermissions();
  const editable =
    editableProp &&
    ["own", "team", "workspace"].some(
      (s) =>
        can(`techsales.proposal_templates.create.${s}`) ||
        can(`techsales.proposal_templates.update.${s}`) ||
        can(`techsales.proposals.create.${s}`) ||
        can(`techsales.proposals.update.${s}`),
    );
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-t border-border bg-card px-3 py-2">
      <Button
        type="button"
        size="sm"
        variant={mode === "master" ? "default" : "outline"}
        className="h-9 shrink-0 gap-1.5 text-xs"
        onClick={onToggleMaster}
      >
        <Layers className="h-3.5 w-3.5" />
        {mode === "master" ? "Voltar às páginas" : "Página mestre"}
      </Button>

      <div className="h-6 w-px shrink-0 bg-border" />

      <div className="flex items-center gap-2">
        {design.pages.map((p, idx) => {
          const active = mode === "page" && idx === pageIndex;
          return (
            <div
              key={p.id}
              className={`group flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectPage(idx)}
                className="flex items-center gap-1.5 text-left"
              >
                <span
                  className="inline-block h-6 w-4 shrink-0 rounded-sm border border-border shadow-2xs"
                  style={{ backgroundColor: p.backgroundColor }}
                  aria-hidden="true"
                />
                <span className="max-w-28 truncate font-medium">
                  {String(idx + 1).padStart(2, "0")} · {p.name}
                </span>
              </button>

              {editable && (
                <div className="flex items-center gap-0.5 opacity-75 group-hover:opacity-100">
                  {idx > 0 && (
                    <button
                      type="button"
                      aria-label={`Mover página ${idx + 1} para esquerda`}
                      onClick={() => onMovePage(idx, idx - 1)}
                      className="rounded p-0.5 hover:bg-muted"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                  )}
                  {idx < design.pages.length - 1 && (
                    <button
                      type="button"
                      aria-label={`Mover página ${idx + 1} para direita`}
                      onClick={() => onMovePage(idx, idx + 1)}
                      className="rounded p-0.5 hover:bg-muted"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Duplicar página ${idx + 1}`}
                    onClick={() => onDuplicatePage(idx)}
                    className="rounded p-0.5 hover:bg-muted"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  {design.pages.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Excluir página ${idx + 1}`}
                      onClick={() => onDeletePage(idx)}
                      className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editable && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 shrink-0 gap-1 text-xs"
          onClick={onAddPage}
        >
          <Plus className="h-3.5 w-3.5" />
          Nova página
        </Button>
      )}
    </div>
  );
}
