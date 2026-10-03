import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMyRole } from "@/lib/use-my-role";
import { bindViewAs, listViewAsOptions, startViewAs } from "@/lib/view-as.functions";
import { enterViewAs, readViewAs } from "@/lib/view-as-client";

/** Seletor "Ver como" — visível só para proprietários/administradores. */
export function ViewAsSwitcher() {
  const { role, loading } = useMyRole();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fetchOptions = useServerFn(listViewAsOptions);
  const start = useServerFn(startViewAs);
  const bind = useServerFn(bindViewAs);
  const isAdmin = !loading && role === "admin";
  const active = typeof window !== "undefined" && !!readViewAs();

  const q = useQuery({
    queryKey: ["view-as-options"],
    queryFn: () => fetchOptions(),
    enabled: isAdmin && open,
    staleTime: 60_000,
  });

  if (!isAdmin || active) return null;

  const choose = async (key: string, input: { user_id: string } | { role_id: string }) => {
    setBusy(key);
    try {
      const res = await start({ data: input });
      await enterViewAs(res, bind);
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível iniciar o Ver como.");
      setBusy(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Ver como outro usuário ou papel">
              <Eye className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Ver como</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Ver como</p>
          <p className="text-xs text-muted-foreground">
            Usuário: ações reais com as permissões da pessoa. Papel: teste somente leitura, sem gravação.
          </p>
        </div>
        <Command>
          <CommandInput
            placeholder="Buscar usuário ou papel…"
            aria-label="Buscar usuário ou papel"
          />
          <CommandList>
            {q.isLoading && (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            )}
            {q.isError && (
              <div className="p-3 text-sm text-destructive">
                {(q.error as Error).message}{" "}
                <button className="underline" onClick={() => q.refetch()}>
                  Tentar novamente
                </button>
              </div>
            )}
            {q.data && <CommandEmpty>Nada encontrado.</CommandEmpty>}
            {q.data && q.data.users.length > 0 && (
              <CommandGroup heading="Usuários">
                {q.data.users.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={`usuario ${u.label} ${u.detail ?? ""}`}
                    disabled={!!busy}
                    onSelect={() => choose(u.id, { user_id: u.id })}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{u.label}</span>
                      {u.detail && (
                        <span className="truncate text-xs text-muted-foreground">{u.detail}</span>
                      )}
                    </div>
                    {busy === u.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {q.data && q.data.roles.length > 0 && (
              <CommandGroup heading="Papéis">
                {q.data.roles.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`papel ${r.label}`}
                    disabled={!!busy}
                    onSelect={() => choose(r.id, { role_id: r.id })}
                  >
                    <span className="flex-1 truncate">{r.label}</span>
                    {busy === r.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
