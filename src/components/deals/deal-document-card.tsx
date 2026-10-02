// Cartão padrão dos documentos do negócio (Cotações, Propostas, Contratos):
// título com link, situação, metadados e menu "..." de ações.
import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type DocAction =
  | { kind: "item"; label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean }
  | { kind: "separator" };

export function DealDocumentCard({
  title,
  onOpen,
  status,
  meta,
  actions,
}: {
  title: string;
  onOpen: () => void;
  status: ReactNode;
  meta?: ReactNode;
  actions: DocAction[];
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 text-left font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm truncate"
        >
          {title}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Ações">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {actions.map((a, i) =>
              a.kind === "separator" ? (
                <DropdownMenuSeparator key={`s${i}`} />
              ) : (
                <DropdownMenuItem
                  key={a.label}
                  disabled={a.disabled}
                  onSelect={a.onSelect}
                  className={a.destructive ? "text-destructive focus:text-destructive" : undefined}
                >
                  {a.label}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 space-y-1 text-sm">
        <div>{status}</div>
        {meta && <div className="text-xs text-muted-foreground tabular-nums">{meta}</div>}
      </div>
    </div>
  );
}

export function DealDocsHeader({
  count,
  singular,
  plural,
  onAdd,
}: {
  count: number;
  singular: string;
  plural: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        {count === 0 ? `Nenhum(a) ${singular}` : `${count} ${count === 1 ? singular : plural}`}
      </span>
      <Button size="sm" variant="link" className="h-auto p-0" onClick={onAdd}>
        + Adicionar
      </Button>
    </div>
  );
}
