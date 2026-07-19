// Seletor compartilhado de empresa (legal_entity) para filtros do módulo Financeiro.
// Retorna "all" quando não há filtro. Persistido no client somente durante a sessão.
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
