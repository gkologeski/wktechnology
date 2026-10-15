// Editor de público em grupos (estilo segmentos do HubSpot): filtros dentro do
// grupo combinados por E (ou OU), grupos ligados por E ou OU. Só apresentação.
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENTITY_LABEL,
  FILTER_FIELDS,
  MAX_AUDIENCE_GROUPS,
  MAX_FILTERS_PER_GROUP,
  OPS_BY_KIND,
  opNeedsValue,
  type AudienceBase,
  type AudienceFilter,
  type AudienceGroup,
} from "@/lib/whatsapp/campaign-audience";

const ENTITIES = Object.keys(ENTITY_LABEL) as AudienceBase[];

export function defaultFilter(base: AudienceBase): AudienceFilter {
  const d = FILTER_FIELDS[base][0];
  return { entity: base, column: d.column, op: OPS_BY_KIND[d.kind][0].op, value: "" };
}

export function AudienceGroupsEditor({
  base,
  groups,
  onChange,
  members,
  groupsLogic = "or",
  onGroupsLogicChange,
}: {
  base: AudienceBase;
  groups: AudienceGroup[];
  onChange: (g: AudienceGroup[]) => void;
  groupsLogic?: "and" | "or";
  onGroupsLogicChange?: (l: "and" | "or") => void;
  members: { value: string; label: string }[];
}) {
  const setGroup = (i: number, g: AudienceGroup) =>
    onChange(groups.map((x, j) => (j === i ? g : x)));
  // Base primeiro no seletor.
  const ordered = [base, ...ENTITIES.filter((e) => e !== base)];

  const between = groupsLogic === "and" ? "E" : "OU";

  return (
    <div className="space-y-2">
      {groups.length > 1 && onGroupsLogicChange && (
        <div className="flex items-center gap-2 text-xs">
          <span id="groups-logic-label" className="text-muted-foreground">
            Combinar grupos com
          </span>
          <Select value={groupsLogic} onValueChange={(l) => onGroupsLogicChange(l as "and" | "or")}>
            <SelectTrigger aria-labelledby="groups-logic-label" className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="or">OU (qualquer grupo)</SelectItem>
              <SelectItem value="and">E (todos os grupos)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Sem filtros: entram todos os registros da base. Adicione um grupo para filtrar.
        </p>
      )}
      {groups.map((g, gi) => (
        <div key={gi} className="space-y-2">
          {gi > 0 && (
            <div className="flex items-center gap-2" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {between}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          )}
          <section
            aria-label={`Grupo ${gi + 1}`}
            className="space-y-2 rounded-md border bg-muted/30 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">Grupo {gi + 1}</span>
                <span className="text-muted-foreground">· combinar filtros com</span>
                <Select
                  value={g.logic}
                  onValueChange={(l) => setGroup(gi, { ...g, logic: l as "and" | "or" })}
                >
                  <SelectTrigger className="h-7 w-20" aria-label={`Operador do grupo ${gi + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="and">E</SelectItem>
                    <SelectItem value="or">OU</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Duplicar grupo ${gi + 1}`}
                  disabled={groups.length >= MAX_AUDIENCE_GROUPS}
                  onClick={() =>
                    onChange([
                      ...groups.slice(0, gi + 1),
                      structuredClone(g),
                      ...groups.slice(gi + 1),
                    ])
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover grupo ${gi + 1}`}
                  onClick={() => onChange(groups.filter((_, j) => j !== gi))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {g.filters.map((f, fi) => {
              const entity = f.entity ?? base;
              const def = FILTER_FIELDS[entity].find((d) => d.column === f.column);
              const ops = def ? OPS_BY_KIND[def.kind] : [];
              const upd = (patch: Partial<AudienceFilter>) =>
                setGroup(gi, {
                  ...g,
                  filters: g.filters.map((x, j) => (j === fi ? { ...x, ...patch } : x)),
                });
              return (
                <div key={fi} className="space-y-1">
                  {fi > 0 && (
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {g.logic === "and" ? "E" : "OU"}
                    </span>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={`${entity}.${f.column}`}
                      onValueChange={(key) => {
                        const [e, c] = key.split(".") as [AudienceBase, string];
                        const d = FILTER_FIELDS[e].find((x) => x.column === c);
                        if (!d) return;
                        upd({ entity: e, column: c, op: OPS_BY_KIND[d.kind][0].op, value: "" });
                      }}
                    >
                      <SelectTrigger className="w-52" aria-label="Entidade e campo do filtro">
                        <SelectValue>
                          {ENTITY_LABEL[entity]} › {def?.label ?? f.column}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ordered.map((e) => (
                          <SelectGroup key={e}>
                            <SelectLabel>
                              {ENTITY_LABEL[e]}
                              {e !== base ? " (relacionado)" : ""}
                            </SelectLabel>
                            {FILTER_FIELDS[e].map((d) => (
                              <SelectItem key={`${e}.${d.column}`} value={`${e}.${d.column}`}>
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={f.op}
                      onValueChange={(o) => upd({ op: o as AudienceFilter["op"] })}
                    >
                      <SelectTrigger className="w-36" aria-label="Condição">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ops.map((o) => (
                          <SelectItem key={o.op} value={o.op}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {opNeedsValue(f.op) &&
                      (def?.kind === "enum" || def?.kind === "member" ? (
                        <Select value={f.value} onValueChange={(v) => upd({ value: v })}>
                          <SelectTrigger className="w-48" aria-label="Valor do filtro">
                            <SelectValue placeholder="Escolha" />
                          </SelectTrigger>
                          <SelectContent>
                            {(def.kind === "enum" ? (def.options ?? []) : members).map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="w-48"
                          aria-label="Valor do filtro"
                          type={def?.kind === "date" ? "date" : "text"}
                          maxLength={200}
                          value={f.value}
                          onChange={(e) => upd({ value: e.target.value })}
                        />
                      ))}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remover filtro"
                      onClick={() =>
                        setGroup(gi, { ...g, filters: g.filters.filter((_, j) => j !== fi) })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              disabled={g.filters.length >= MAX_FILTERS_PER_GROUP}
              onClick={() => setGroup(gi, { ...g, filters: [...g.filters, defaultFilter(base)] })}
            >
              <Plus className="mr-1 h-4 w-4" /> Adicionar filtro
            </Button>
          </section>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        disabled={groups.length >= MAX_AUDIENCE_GROUPS}
        onClick={() => onChange([...groups, { logic: "and", filters: [defaultFilter(base)] }])}
      >
        <Plus className="mr-1 h-4 w-4" />{" "}
        {groups.length ? `Adicionar grupo ${between}` : "Adicionar grupo"}
      </Button>
    </div>
  );
}
