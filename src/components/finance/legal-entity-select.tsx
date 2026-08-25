// Seletor compartilhado de empresa/grupo para filtros do módulo Financeiro.
//
// A seleção é codificada em uma string única (`selection`) para caber no
// mesmo estado global (localStorage + `?le=`):
//   "all"          → sem filtro
//   "<uuid>"       → filtra por um CNPJ específico (legal_entity)
//   "g:<uuid>"     → filtra por um grupo empresarial (vários CNPJs)
//
// Server functions do módulo aceitam tanto `legalEntityId` (uuid) quanto
// `legalEntityIds` (array). O helper `useLegalEntityFilterInput()` resolve
// o grupo em uma lista de ids e devolve o payload pronto para spread.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Users } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listLegalEntities } from "@/lib/legal-entities.functions";
import { listLegalEntityGroups } from "@/lib/legal-entity-groups.functions";

export const ALL_LEGAL_ENTITIES = "all";
export const GROUP_PREFIX = "g:";
const STORAGE_KEY = "finance.legalEntityId";
const URL_PARAM = "le";

function readInitial(): string {
  if (typeof window === "undefined") return ALL_LEGAL_ENTITIES;
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get(URL_PARAM);
    if (fromUrl) return fromUrl;
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    if (fromStorage) return fromStorage;
  } catch {
    // ignore
  }
  return ALL_LEGAL_ENTITIES;
}

export function useLegalEntityFilter(): [string, (v: string) => void] {
  const [value, setValue] = useState<string>(ALL_LEGAL_ENTITIES);

  useEffect(() => {
    setValue(readInitial());
  }, []);

  const update = useCallback((next: string) => {
    setValue(next);
    if (typeof window === "undefined") return;
    try {
      if (next && next !== ALL_LEGAL_ENTITIES) {
        window.localStorage.setItem(STORAGE_KEY, next);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      const url = new URL(window.location.href);
      if (next && next !== ALL_LEGAL_ENTITIES) {
        url.searchParams.set(URL_PARAM, next);
      } else {
        url.searchParams.delete(URL_PARAM);
      }
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setValue(e.newValue || ALL_LEGAL_ENTITIES);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return [value, update];
}

export function useLegalEntities() {
  const list = useServerFn(listLegalEntities);
  return useQuery({
    queryKey: ["legal-entities", "list"],
    queryFn: () => list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLegalEntityGroups() {
  const list = useServerFn(listLegalEntityGroups);
  return useQuery({
    queryKey: ["legal-entity-groups", "list"],
    queryFn: () => list(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Resolve o filtro atual em um payload pronto para spread nas server functions
 * do módulo Financeiro. Retorna `{}` para "todas", `{ legalEntityId }` para
 * um CNPJ específico ou `{ legalEntityIds }` para um grupo empresarial.
 */
export function useLegalEntityFilterInput(selection: string): {
  legalEntityId?: string;
  legalEntityIds?: string[];
} {
  const { data: groups = [] } = useLegalEntityGroups();
  return useMemo(() => {
    if (!selection || selection === ALL_LEGAL_ENTITIES) return {};
    if (selection.startsWith(GROUP_PREFIX)) {
      const groupId = selection.slice(GROUP_PREFIX.length);
      const g = (groups as Array<{ id: string; member_ids: string[] }>).find(
        (x) => x.id === groupId,
      );
      const ids = g?.member_ids ?? [];
      // Se o grupo ainda está carregando ou está vazio, filtra impossível para
      // evitar mostrar dados de todas as empresas por engano.
      if (!ids.length) return { legalEntityIds: ["00000000-0000-0000-0000-000000000000"] };
      return { legalEntityIds: ids };
    }
    return { legalEntityId: selection };
  }, [selection, groups]);
}

export function LegalEntitySelect({
  value,
  onChange,
  className,
  placeholder = "Todas as empresas",
  width = "w-64",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  width?: string;
}) {
  const { data: entities = [] } = useLegalEntities();
  const { data: groups = [] } = useLegalEntityGroups();

  const groupList = groups as unknown as Array<{
    id: string;
    name: string;
    is_system: boolean;
  }>;
  const nonSystemGroups = groupList.filter((g) => !g.is_system);
  const systemGroup = groupList.find((g) => g.is_system);

  // Nada a filtrar se só há uma empresa e nenhum grupo customizado.
  if (entities.length <= 1 && nonSystemGroups.length === 0) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`${width} ${className ?? ""}`}>
        <Building2 className="h-4 w-4 mr-1 text-muted-foreground" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_LEGAL_ENTITIES}>
          {systemGroup ? systemGroup.name : "Todas as empresas"}
        </SelectItem>

        {nonSystemGroups.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel className="flex items-center gap-1 text-xs">
                <Users className="h-3 w-3" /> Grupos empresariais
              </SelectLabel>
              {nonSystemGroups.map((g) => (
                <SelectItem key={g.id} value={`${GROUP_PREFIX}${g.id}`}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}

        {entities.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel className="flex items-center gap-1 text-xs">
                <Building2 className="h-3 w-3" /> Empresas (CNPJs)
              </SelectLabel>
              {(entities as Array<{ id: string; code: string | null; name: string }>).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.code ? `${e.code} · ${e.name}` : e.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
