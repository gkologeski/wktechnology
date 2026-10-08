// Seleção pesquisável do título do perfil a partir de "Presets e cargos".
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { listRoleProfileTitleOptions } from "@/lib/role-profiles/role-profiles.functions";

export type TitleOption = {
  kind: "job_profile" | "preset";
  id: string;
  name: string;
  seniority: string | null;
  jobProfileId: string | null;
};

export function useTitleOptions() {
  const fn = useServerFn(listRoleProfileTitleOptions);
  return useQuery({
    queryKey: ["role-profile-title-options"],
    queryFn: async () => {
      const r = await fn();
      const opts: TitleOption[] = [
        ...r.jobProfiles.map((j) => ({
          kind: "job_profile" as const,
          id: j.id,
          name: j.name,
          seniority: j.seniority,
          jobProfileId: j.id,
        })),
        ...r.presets.map((p) => ({
          kind: "preset" as const,
          id: p.id,
          name: p.name,
          seniority: p.seniority,
          jobProfileId: p.job_profile_id,
        })),
      ];
      return opts;
    },
    staleTime: 5 * 60_000,
  });
}

function OptionList({
  options,
  isSelected,
  onPick,
}: {
  options: TitleOption[];
  isSelected: (o: TitleOption) => boolean;
  onPick: (o: TitleOption) => void;
}) {
  const groups: [string, TitleOption[]][] = [
    ["Cargos", options.filter((o) => o.kind === "job_profile")],
    ["Presets de contratação", options.filter((o) => o.kind === "preset")],
  ];
  return (
    <Command>
      <CommandInput placeholder="Buscar cargo ou preset…" />
      <CommandList>
        <CommandEmpty>Nenhum cargo ou preset encontrado.</CommandEmpty>
        {groups.map(([label, xs]) =>
          xs.length ? (
            <CommandGroup key={label} heading={label}>
              {xs.map((o) => (
                <CommandItem
                  key={`${o.kind}:${o.id}`}
                  value={`${o.name} ${o.kind}:${o.id}`}
                  onSelect={() => onPick(o)}
                >
                  <Check
                    className={cn("mr-2 h-3.5 w-3.5", isSelected(o) ? "opacity-100" : "opacity-0")}
                    aria-hidden
                  />
                  <span className="truncate">{o.name}</span>
                  {o.seniority ? (
                    <span className="ml-auto pl-2 text-[11px] text-text-tertiary">
                      {o.seniority}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null,
        )}
      </CommandList>
    </Command>
  );
}

export function RoleProfileTitlePicker({
  id,
  title,
  jobProfileId,
  presetId,
  onPick,
  disabled,
}: {
  id?: string;
  title: string;
  jobProfileId: string | null;
  presetId: string | null;
  onPick: (o: TitleOption) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const q = useTitleOptions();
  const linked = !!jobProfileId || !!presetId;
  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-9 w-full justify-between font-normal"
          >
            <span className={cn("truncate", !title && "text-text-tertiary")}>
              {title || "Selecione um cargo ou preset"}
            </span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
          {q.isLoading ? (
            <p className="p-3 text-xs text-text-tertiary">Carregando…</p>
          ) : q.isError ? (
            <p className="p-3 text-xs text-destructive">Não foi possível carregar os cargos.</p>
          ) : (
            <OptionList
              options={q.data ?? []}
              isSelected={(o) =>
                o.kind === "preset" ? o.id === presetId : !presetId && o.id === jobProfileId
              }
              onPick={(o) => {
                onPick(o);
                setOpen(false);
              }}
            />
          )}
        </PopoverContent>
      </Popover>
      {title && !linked ? (
        <Badge variant="outline" className="h-5 border-warning/40 text-[10px] text-warning">
          Título livre (antigo) — selecione um cargo para vincular
        </Badge>
      ) : null}
    </div>
  );
}

/** Seleção múltipla para adicionar vários cargos/presets de uma vez. */
export function AddTitlesPicker({
  onAdd,
  disabled,
}: {
  onAdd: (xs: TitleOption[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<TitleOption[]>([]);
  const q = useTitleOptions();
  const key = (o: TitleOption) => `${o.kind}:${o.id}`;
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPicked([]);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={disabled}>
          Adicionar cargos
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <OptionList
          options={q.data ?? []}
          isSelected={(o) => picked.some((p) => key(p) === key(o))}
          onPick={(o) =>
            setPicked((xs) =>
              xs.some((p) => key(p) === key(o)) ? xs.filter((p) => key(p) !== key(o)) : [...xs, o],
            )
          }
        />
        <div className="flex items-center justify-between border-t border-product-divider p-2">
          <span className="text-xs text-text-secondary">{picked.length} selecionado(s)</span>
          <Button
            size="sm"
            disabled={!picked.length}
            onClick={() => {
              onAdd(picked);
              setPicked([]);
              setOpen(false);
            }}
          >
            Adicionar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
