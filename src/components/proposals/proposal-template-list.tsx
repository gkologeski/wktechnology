import { LayoutTemplate } from "lucide-react";
import { Copy, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { cn } from "@/lib/utils";

export type ProposalTemplateItem = {
  id: string;
  name: string;
  description: string | null;
  html: string;
  is_default: boolean;
  contract_template_id: string | null;
  layout_kind?: "rich_text" | "visual";
  design_json?: unknown;
  services: string[];
};

type ProposalTemplateListProps = {
  templates: ProposalTemplateItem[];
  selectedId: string | null;
  isBusy: boolean;
  busyTemplateId: string | null;
  onSelect: (template: ProposalTemplateItem) => void;
  onEdit: (template: ProposalTemplateItem) => void;
  onDuplicate: (template: ProposalTemplateItem) => void;
  onDelete: (template: ProposalTemplateItem) => void;
};

export function ProposalTemplateList({
  templates,
  selectedId,
  isBusy,
  busyTemplateId,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
}: ProposalTemplateListProps) {
  const { can } = usePermissions();
  const allowed = (action: string) =>
    ["own", "team", "workspace"].some((s) => can(`techsales.proposal_templates.${action}.${s}`));
  const canCreate = allowed("create");
  const canUpdate = allowed("update");
  const canDelete = allowed("delete");

  return (
    <nav aria-label="Modelos" className="min-w-0 space-y-1.5">
      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum modelo. Crie o primeiro.</p>
      )}
      {templates.map((t) => {
        const isSelected = selectedId === t.id;
        const isItemBusy = busyTemplateId === t.id;
        return (
          <div
            key={t.id}
            className={cn(
              "flex min-w-0 items-start gap-1 rounded-md border transition-colors",
              isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
            )}
          >
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onSelect(t)}
              className="min-w-0 flex-1 rounded-l-md px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{t.name}</span>
                {t.layout_kind === "visual" && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    <LayoutTemplate className="h-2.5 w-2.5" aria-hidden="true" />
                    Visual
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {t.services.length} serviço(s) vinculado(s)
              </div>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isBusy}
                  aria-label={`Ações do modelo ${t.name}`}
                  className="m-1 h-8 w-8 shrink-0"
                >
                  {isItemBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  disabled={!canUpdate || isBusy}
                  title={
                    !canUpdate ? "Seu cargo não tem permissão para editar modelos." : undefined
                  }
                  onSelect={() => onEdit(t)}
                  className="items-start gap-2"
                >
                  <Pencil className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span>Editar</span>
                    {!canUpdate && (
                      <span className="text-xs text-muted-foreground">
                        Sem permissão para editar
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  disabled={!canCreate || isBusy}
                  title={
                    !canCreate
                      ? "Seu cargo não tem permissão para criar ou duplicar modelos."
                      : undefined
                  }
                  onSelect={() => onDuplicate(t)}
                  className="items-start gap-2"
                >
                  <Copy className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span>Duplicar</span>
                    {!canCreate && (
                      <span className="text-xs text-muted-foreground">
                        Sem permissão para criar
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  disabled={!canDelete || isBusy}
                  title={
                    !canDelete ? "Seu cargo não tem permissão para excluir modelos." : undefined
                  }
                  onSelect={() => onDelete(t)}
                  className="items-start gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span>Excluir</span>
                    {!canDelete && (
                      <span className="text-xs text-muted-foreground">
                        Sem permissão para excluir
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </nav>
  );
}
