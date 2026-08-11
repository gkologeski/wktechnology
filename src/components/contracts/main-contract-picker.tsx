// Seletor de contrato principal (document_kind = 'main') com busca server-side.
// Reutilizado no painel de aditivos e na importação em lote.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchMainContracts } from "@/lib/contracts.functions";

export type MainContractOption = {
  id: string;
  number: string | null;
  title: string;
  status: string;
  role: string;
};

export function MainContractPicker({
  value,
  onChange,
  excludeId,
  role,
  disabled = false,
  placeholder = "Buscar contrato principal…",
  triggerClassName,
  ariaLabel = "Contrato principal",
}: {
  value: MainContractOption | null;
  onChange: (next: MainContractOption | null) => void;
  excludeId?: string;
  /** Restringe a busca ao papel informado (aditivo herda o papel do principal). */
  role?: "provider" | "client";
  disabled?: boolean;
  placeholder?: string;
  triggerClassName?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const search = useServerFn(searchMainContracts);

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["contracts", "main-search", q, excludeId ?? null, role ?? null],
    queryFn: () =>
      search({
        data: {
          q: q || undefined,
          ...(excludeId ? { excludeId } : {}),
          ...(role ? { role } : {}),
          limit: 20,
        },
      }),
    enabled: open,
    staleTime: 15_000,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", triggerClassName)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? `${value.number ? `${value.number} · ` : ""}${value.title}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Título ou número…"
              className="h-9 pl-8"
              aria-label="Buscar contrato principal"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {isFetching ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Buscando…
            </div>
          ) : rows.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum contrato encontrado.</p>
          ) : (
            rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onChange(r as MainContractOption);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <Check
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    value?.id === r.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.title}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {r.number ?? "—"} · {r.role === "provider" ? "Prestação" : "Compra"}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        {value ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Limpar seleção
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
