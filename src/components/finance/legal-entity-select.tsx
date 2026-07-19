// Seletor compartilhado de empresa (legal_entity) para filtros do módulo Financeiro.
// Retorna "all" quando não há filtro. Persistido via localStorage + query param `?le=`
// para manter o filtro ao navegar entre telas e recarregar a página.
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listLegalEntities } from "@/lib/legal-entities.functions";

export const ALL_LEGAL_ENTITIES = "all";
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

/**
 * Estado persistido do filtro por empresa (compartilhado entre telas do Financeiro).
 * - Persiste em localStorage para manter entre navegações e reloads.
 * - Reflete o valor atual em `?le=` no URL para permitir compartilhar links.
 */
export function useLegalEntityFilter(): [string, (v: string) => void] {
  const [value, setValue] = useState<string>(ALL_LEGAL_ENTITIES);

  // Hidratação client-side (evita divergência de SSR).
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

  // Sincroniza entre abas via evento de storage.
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

export function LegalEntitySelect({
  value,
  onChange,
  className,
  placeholder = "Todas as empresas",
  width = "w-56",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  width?: string;
}) {
  const { data: entities = [] } = useLegalEntities();
  if (entities.length <= 1) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`${width} ${className ?? ""}`}>
        <Building2 className="h-4 w-4 mr-1 text-muted-foreground" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_LEGAL_ENTITIES}>Todas as empresas</SelectItem>
        {entities.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.code ? `${e.code} · ${e.name}` : e.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
