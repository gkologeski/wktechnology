// Página /settings/record-layouts — configurador do sidebar (PropertiesPanel) por entidade.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  getRecordLayout,
  upsertRecordLayout,
  type LayoutSection,
  type RecordEntity,
} from "@/lib/record-layouts.functions";

export const Route = createFileRoute("/_authenticated/settings/record-layouts")({
  component: RecordLayoutsPage,
});

type FieldDef = { key: string; label: string };

const ENTITY_LABELS: Record<RecordEntity, string> = {
  leads: "Leads",
  contacts: "Contatos",
  companies: "Empresas",
  deals: "Negócios",
};

// Espelha os campos padrão renderizados em cada record page (props passados ao PropertiesPanel).
const ENTITY_FIELDS: Record<RecordEntity, FieldDef[]> = {
  leads: [
    { key: "first_name", label: "Nome" },
    { key: "last_name", label: "Sobrenome" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefone" },
    { key: "company_name", label: "Empresa" },
    { key: "source", label: "Fonte" },
    { key: "label", label: "Label" },
    { key: "score", label: "Score" },
    { key: "notes", label: "Notas" },
  ],
  contacts: [
    { key: "first_name", label: "Nome" },
    { key: "last_name", label: "Sobrenome" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefone" },
    { key: "mobile_phone", label: "Celular" },
    { key: "job_title", label: "Cargo" },
    { key: "notes", label: "Notas" },
  ],
  companies: [
    { key: "name", label: "Nome" },
    { key: "domain", label: "Domínio" },
    { key: "website", label: "Website" },
    { key: "industry", label: "Indústria" },
    { key: "size", label: "Tamanho" },
    { key: "phone", label: "Telefone" },
    { key: "cep", label: "CEP" },
    { key: "address", label: "Endereço" },
    { key: "city", label: "Cidade" },
    { key: "state", label: "UF" },
    { key: "notes", label: "Notas" },
  ],
  deals: [
    { key: "name", label: "Nome" },
    { key: "value", label: "Valor" },
    { key: "currency", label: "Moeda" },
    { key: "stage", label: "Etapa" },
    { key: "expected_close_date", label: "Fechamento previsto" },
    { key: "dealtype", label: "Tipo" },
    { key: "hs_priority", label: "Prioridade" },
    { key: "description", label: "Descrição" },
    { key: "notes", label: "Notas" },
  ],
};

function defaultLayout(entity: RecordEntity): LayoutSection[] {
  return [{ title: "Sobre", keys: ENTITY_FIELDS[entity].slice(0, 6).map((f) => f.key) }];
}

function RecordLayoutsPage() {
  const getFn = useServerFn(getRecordLayout);
  const saveFn = useServerFn(upsertRecordLayout);

  const [entity, setEntity] = useState<RecordEntity>("leads");
  const [sections, setSections] = useState<LayoutSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [addPick, setAddPick] = useState<Record<number, string>>({});

  const fields = ENTITY_FIELDS[entity];
  const labelFor = (k: string) => fields.find((f) => f.key === k)?.label ?? k;

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getFn({ data: { entity } })
      .then((r) => {
        if (!cancel) setSections(r.sections ?? defaultLayout(entity));
      })
      .catch(() => {
        if (!cancel) setSections(defaultLayout(entity));
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [entity, getFn]);

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { entity, sections } }),
    onSuccess: () => toast.success("Layout salvo"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const updateSection = (i: number, patch: Partial<LayoutSection>) =>
    setSections((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const removeSection = (i: number) => setSections((cur) => cur.filter((_, idx) => idx !== i));
  const addSection = () => setSections((cur) => [...cur, { title: "Nova seção", keys: [] }]);
  const moveSection = (i: number, dir: -1 | 1) => {
    setSections((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const copy = [...cur];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const addKey = (i: number, key: string) => {
    if (!key) return;
    setSections((cur) =>
      cur.map((s, idx) =>
        idx === i && !s.keys.includes(key) ? { ...s, keys: [...s.keys, key] } : s,
      ),
    );
    setAddPick((p) => ({ ...p, [i]: "" }));
  };
  const removeKey = (i: number, key: string) =>
    updateSection(i, { keys: sections[i].keys.filter((k) => k !== key) });
  const moveKey = (i: number, key: string, dir: -1 | 1) => {
    setSections((cur) =>
      cur.map((s, idx) => {
        if (idx !== i) return s;
        const arr = [...s.keys];
        const p = arr.indexOf(key);
        const np = p + dir;
        if (p < 0 || np < 0 || np >= arr.length) return s;
        [arr[p], arr[np]] = [arr[np], arr[p]];
        return { ...s, keys: arr };
      }),
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Layout do registro"
        description="Configure quais campos aparecem na barra lateral (Sobre) das telas de registro, em seções."
        actions={
          <Button onClick={() => saveMut.mutate()} disabled={loading || saveMut.isPending}>
            {saveMut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        }
      />

      <Tabs value={entity} onValueChange={(v) => setEntity(v as RecordEntity)}>
        <TabsList>
          {(Object.keys(ENTITY_LABELS) as RecordEntity[]).map((e) => (
            <TabsTrigger key={e} value={e}>
              {ENTITY_LABELS[e]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Seções — {ENTITY_LABELS[entity]}</CardTitle>
          <Button size="sm" variant="outline" onClick={addSection}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar seção
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : sections.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma seção definida. Adicione uma para começar.
            </div>
          ) : (
            sections.map((s, i) => {
              const available = fields.filter((f) => !s.keys.includes(f.key));
              return (
                <div key={i} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={s.title}
                      onChange={(e) => updateSection(i, { title: e.target.value })}
                      className="h-8 max-w-xs"
                    />
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => moveSection(i, -1)}
                        disabled={i === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => moveSection(i, 1)}
                        disabled={i === sections.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeSection(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.keys.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Nenhum campo nesta seção.
                      </span>
                    )}
                    {s.keys.map((k) => (
                      <Badge key={k} variant="secondary" className="gap-1 pr-1">
                        <span>{labelFor(k)}</span>
                        <button
                          onClick={() => moveKey(i, k, -1)}
                          className="px-0.5 hover:opacity-70"
                          title="Subir"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => moveKey(i, k, 1)}
                          className="px-0.5 hover:opacity-70"
                          title="Descer"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeKey(i, k)}
                          className="px-0.5 hover:opacity-70"
                          title="Remover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={addPick[i] ?? ""}
                      onValueChange={(v) => setAddPick((p) => ({ ...p, [i]: v }))}
                    >
                      <SelectTrigger className="h-8 max-w-xs">
                        <SelectValue placeholder="Selecionar campo…" />
                      </SelectTrigger>
                      <SelectContent>
                        {available.length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Todos os campos já adicionados.
                          </div>
                        )}
                        {available.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addKey(i, addPick[i] ?? "")}
                      disabled={!addPick[i]}
                    >
                      Adicionar
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Quando nenhuma seção estiver definida, o sidebar usa o comportamento padrão (campos marcados
        como primários).
      </p>
    </div>
  );
}
