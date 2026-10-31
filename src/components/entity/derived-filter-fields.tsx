import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelectOptions } from "@/components/ui/multi-select-options";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { toLabel } from "@/lib/entity-fields-meta";
import { DERIVED_CRM_FIELDS } from "@/lib/entity/derived-fields";
import { isMultiValue, joinMulti, splitMulti } from "@/lib/entity/derived-filter-query";
import {
  listCompanyDerivedOptions,
  listContactDerivedOptions,
  listLeadDerivedOptions,
} from "@/lib/entity/derived-filter-options.functions";

type Entity = "leads" | "contacts" | "companies";

function DerivedChoice({
  entity,
  column,
  value,
  onChange,
}: {
  entity: Entity;
  column: string;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const fn = useServerFn(
    entity === "contacts"
      ? listContactDerivedOptions
      : entity === "leads"
        ? listLeadDerivedOptions
        : listCompanyDerivedOptions,
  );
  const { canAny, isLoading: permsLoading } = usePermissions();
  const resource = `techsales.${entity}`;
  const allowed = canAny(["own", "team", "workspace"].map((s) => `${resource}.view.${s}`));
  const q = useQuery({
    queryKey: ["derived-filter-options", entity, column],
    queryFn: () => fn({ data: { column } }),
    staleTime: 10 * 60_000,
    enabled: allowed,
  });
  // Filtro antigo em texto livre continua valendo até a pessoa escolher opções.
  const selected = isMultiValue(value) ? splitMulti(value) : [];
  const legacy = value && !isMultiValue(value) ? value.trim() : "";
  return (
    <div className="space-y-1">
      <MultiSelectOptions
        value={selected}
        onChange={(next) => onChange(next.length ? joinMulti(next) : "")}
        options={(q.data ?? []).map((v) => ({ value: v, label: v }))}
        placeholder={
          permsLoading || (allowed && q.isLoading)
            ? "Carregando…"
            : !allowed
              ? "Sem permissão"
              : q.isError
                ? "Erro ao carregar"
                : "Todos"
        }
        emptyText={q.isError ? "Não foi possível carregar as opções" : "Nenhuma opção"}
        className="min-h-8 text-xs"
      />
      {legacy && (
        <p className="text-[11px] text-muted-foreground">
          Filtro anterior: contém "{legacy}".{" "}
          <button type="button" className="underline" onClick={() => onChange("")}>
            Limpar
          </button>
        </p>
      )}
    </div>
  );
}

export function DerivedFilterFields({
  entity,
  value = {},
  onChange,
}: {
  entity: Entity;
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}) {
  const keys =
    entity === "companies"
      ? ["size_description"]
      : ["job_title", ...Array.from(DERIVED_CRM_FIELDS).filter((k) => k !== "size_description")];
  return (
    <div className="space-y-2 px-2 py-2">
      {keys.map((key) => (
        <div key={key} className="space-y-1">
          <Label className="text-xs" htmlFor={`${entity}-filter-${key}`}>
            {toLabel(key)}
          </Label>
          {key === "job_title" ? (
            <Input
              id={`${entity}-filter-${key}`}
              className="h-8"
              placeholder="Contém…"
              value={value[key] ?? ""}
              onChange={(event) => onChange({ ...value, [key]: event.target.value })}
            />
          ) : (
            <DerivedChoice
              entity={entity}
              column={key}
              value={value[key]}
              onChange={(v) => onChange({ ...value, [key]: v })}
            />
          )}
        </div>
      ))}
    </div>
  );
}
