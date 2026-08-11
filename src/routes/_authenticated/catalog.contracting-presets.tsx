// /catalog/contracting-presets — Presets de contratação.
// Terceira camada do catálogo: combina linha de serviço + cargo + senioridade +
// stack + valores sugeridos em um pacote pronto ("Dev React Sênior") para
// preencher rapidamente a associação de serviço no contrato.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Copy, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrency } from "@/lib/crm";
import { SENIORITY_LABEL, SENIORITY_OPTIONS } from "@/lib/job-profiles-shared";
import {
  createContractingPreset,
  deleteContractingPreset,
  duplicateContractingPreset,
  listContractingPresets,
  updateContractingPreset,
} from "@/lib/contracting-presets.functions";
import { listJobProfileOptions } from "@/lib/job-profiles.functions";
import { listCatalogServiceOptions } from "@/lib/services.functions";

export const Route = createFileRoute("/_authenticated/catalog/contracting-presets")({
  head: () => ({
    meta: [
      { title: "Presets de contratação" },
      {
        name: "description",
        content:
          "Modelos por tecnologia e perfil para preencher automaticamente serviço, cargo, senioridade e valores nos contratos.",
      },
      { property: "og:title", content: "Presets de contratação" },
      {
        property: "og:description",
        content: "Pacotes prontos de contratação por tecnologia e perfil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractingPresetsPage,
});

type Preset = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  service_catalog_id: string | null;
  job_profile_id: string | null;
  seniority: string | null;
  competencies: string[];
  unit: string;
  default_unit_price: number;
  default_unit_cost: number;
  currency: string;
  notes: string | null;
  active: boolean;
};

type CatalogOption = { id: string; name: string; unit: string; base_price: number };
type ProfileOption = {
  id: string;
  name: string;
  seniority: string | null;
  competencies: string[] | null;
  default_unit_price: number;
  service_catalog_id: string | null;
};

type Draft = {
  name: string;
  code: string;
  description: string;
  serviceCatalogId: string;
  jobProfileId: string;
  seniority: string;
  competencies: string;
  unit: string;
  defaultUnitPrice: number;
  defaultUnitCost: number;
  currency: string;
  notes: string;
  active: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  code: "",
  description: "",
  serviceCatalogId: "",
  jobProfileId: "",
  seniority: "",
  competencies: "",
  unit: "mes",
  defaultUnitPrice: 0,
  defaultUnitCost: 0,
  currency: "BRL",
  notes: "",
  active: true,
};

const UNIT_OPTIONS = [
  { value: "mes", label: "Mês" },
  { value: "hora", label: "Hora" },
  { value: "dia", label: "Dia" },
  { value: "projeto", label: "Projeto" },
  { value: "unidade", label: "Unidade" },
];

function ContractingPresetsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listContractingPresets);
  const create = useServerFn(createContractingPreset);
  const update = useServerFn(updateContractingPreset);
  const remove = useServerFn(deleteContractingPreset);
  const dup = useServerFn(duplicateContractingPreset);
  const listCatalog = useServerFn(listCatalogServiceOptions);
  const listProfiles = useServerFn(listJobProfileOptions);

  const [search, setSearch] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Preset | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["contracting_presets"],
    queryFn: () => list({ data: {} }) as Promise<Preset[]>,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog-service-options"],
    queryFn: () => listCatalog({ data: {} }) as Promise<CatalogOption[]>,
    staleTime: 60_000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["job-profile-options"],
    queryFn: () => listProfiles({ data: {} }) as Promise<ProfileOption[]>,
    staleTime: 60_000,
  });

  const catalogName = useMemo(() => new Map(catalog.map((c) => [c.id, c.name])), [catalog]);
  const profileName = useMemo(() => new Map(profiles.map((p) => [p.id, p.name])), [profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (catalogFilter !== "all" && r.service_catalog_id !== catalogFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.code ?? "").toLowerCase().includes(q) ||
        (r.competencies ?? []).some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [rows, search, catalogFilter]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDraft({
        name: editing.name,
        code: editing.code ?? "",
        description: editing.description ?? "",
        serviceCatalogId: editing.service_catalog_id ?? "",
        jobProfileId: editing.job_profile_id ?? "",
        seniority: editing.seniority ?? "",
        competencies: (editing.competencies ?? []).join(", "),
        unit: editing.unit || "mes",
        defaultUnitPrice: Number(editing.default_unit_price ?? 0),
        defaultUnitCost: Number(editing.default_unit_cost ?? 0),
        currency: editing.currency ?? "BRL",
        notes: editing.notes ?? "",
        active: editing.active,
      });
    } else {
      setDraft(EMPTY_DRAFT);
    }
  }, [open, editing]);

  // Escolher o cargo sugere linha de serviço, senioridade, stack e preço —
  // tudo continua editável.
  function pickProfile(value: string) {
    if (value === "none") {
      setDraft((d) => ({ ...d, jobProfileId: "" }));
      return;
    }
    const p = profiles.find((x) => x.id === value);
    setDraft((d) => {
      const next: Draft = { ...d, jobProfileId: value };
      if (!p) return next;
      if (p.seniority && !d.seniority) next.seniority = p.seniority;
      if ((p.competencies ?? []).length > 0 && !d.competencies.trim())
        next.competencies = (p.competencies ?? []).join(", ");
      if (p.service_catalog_id && !d.serviceCatalogId) next.serviceCatalogId = p.service_catalog_id;
      if (Number(p.default_unit_price) > 0 && !(d.defaultUnitPrice > 0))
        next.defaultUnitPrice = Number(p.default_unit_price);
      return next;
    });
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Informe o nome do preset.");
      return;
    }
    setSaving(true);
    const payload = {
      name: draft.name,
      code: draft.code || null,
      description: draft.description || null,
      serviceCatalogId: draft.serviceCatalogId || null,
      jobProfileId: draft.jobProfileId || null,
      seniority: (draft.seniority || null) as never,
      competencies: draft.competencies
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      unit: draft.unit || "mes",
      defaultUnitPrice: Number(draft.defaultUnitPrice ?? 0),
      defaultUnitCost: Number(draft.defaultUnitCost ?? 0),
      currency: draft.currency || "BRL",
      notes: draft.notes || null,
      active: draft.active,
    };
    try {
      if (editing) await update({ data: { id: editing.id, patch: payload } });
      else await create({ data: payload });
      toast.success(editing ? "Preset atualizado." : "Preset criado.");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["contracting_presets"] });
      await qc.invalidateQueries({ queryKey: ["contracting-preset-options"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: Preset, active: boolean) {
    try {
      await update({ data: { id: r.id, patch: { active } } });
      await qc.invalidateQueries({ queryKey: ["contracting_presets"] });
      await qc.invalidateQueries({ queryKey: ["contracting-preset-options"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function destroy(r: Preset) {
    if (!(await confirmDialog(`Excluir o preset “${r.name}”?`))) return;
    try {
      await remove({ data: { id: r.id } });
      toast.success("Preset excluído.");
      await qc.invalidateQueries({ queryKey: ["contracting_presets"] });
      await qc.invalidateQueries({ queryKey: ["contracting-preset-options"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function duplicate(r: Preset) {
    try {
      await dup({ data: { id: r.id } });
      toast.success("Preset duplicado.");
      await qc.invalidateQueries({ queryKey: ["contracting_presets"] });
      await qc.invalidateQueries({ queryKey: ["contracting-preset-options"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Layers aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Presets de contratação</h1>
          <p className="text-sm text-muted-foreground">
            Pacotes prontos por tecnologia e perfil. Ao associar um serviço no contrato, o preset
            preenche linha de serviço, cargo, senioridade, stack e valores.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus aria-hidden="true" className="h-4 w-4 mr-1" /> Novo preset
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Presets cadastrados</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Input
              placeholder="Buscar por nome, código ou stack…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
              aria-label="Buscar presets"
            />
            <Select value={catalogFilter} onValueChange={setCatalogFilter}>
              <SelectTrigger className="w-[240px]" aria-label="Filtrar por linha de serviço">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as linhas de serviço</SelectItem>
                {catalog.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar os presets.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-md border bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "Nenhum preset cadastrado. Comece criando “Dev React Sênior” ou “Assistente Financeiro Pleno”."
                : "Nenhum preset encontrado com os filtros atuais."}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      {r.code ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {r.code}
                        </Badge>
                      ) : null}
                      {r.job_profile_id ? (
                        <Badge variant="outline" className="text-xs">
                          {profileName.get(r.job_profile_id) ?? "Cargo"}
                        </Badge>
                      ) : null}
                      {r.seniority ? (
                        <Badge variant="secondary" className="text-xs">
                          {SENIORITY_LABEL[r.seniority] ?? r.seniority}
                        </Badge>
                      ) : null}
                      {r.service_catalog_id ? (
                        <Badge variant="outline" className="text-xs">
                          {catalogName.get(r.service_catalog_id) ?? "Linha de serviço"}
                        </Badge>
                      ) : null}
                      {!r.active ? (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground tabular-nums">
                      {Number(r.default_unit_price) > 0 ? (
                        <span>
                          Preço {formatCurrency(Number(r.default_unit_price), r.currency)} /{" "}
                          {UNIT_OPTIONS.find((u) => u.value === r.unit)?.label ?? r.unit}
                        </span>
                      ) : null}
                      {Number(r.default_unit_cost) > 0 ? (
                        <span>Custo {formatCurrency(Number(r.default_unit_cost), r.currency)}</span>
                      ) : null}
                      {(r.competencies ?? []).length > 0 ? (
                        <span>Stack: {r.competencies.join(", ")}</span>
                      ) : null}
                    </div>
                    {r.description ? (
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                        {r.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      checked={r.active}
                      onCheckedChange={(v) => toggleActive(r, v)}
                      aria-label={r.active ? "Desativar preset" : "Ativar preset"}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                      aria-label={`Editar ${r.name}`}
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => duplicate(r)}
                      aria-label={`Duplicar ${r.name}`}
                    >
                      <Copy aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => destroy(r)}
                      aria-label={`Excluir ${r.name}`}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar preset" : "Novo preset"}</DialogTitle>
            <DialogDescription>
              O preset apenas sugere valores na associação do serviço ao contrato. Nada fica
              travado: todos os campos continuam editáveis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cp-name">Nome do preset *</Label>
                <Input
                  id="cp-name"
                  placeholder="Dev React Sênior, Assistente Financeiro Pleno…"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-code">Código</Label>
                <Input
                  id="cp-code"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cp-profile">Cargo / perfil</Label>
                <Select value={draft.jobProfileId || "none"} onValueChange={pickProfile}>
                  <SelectTrigger id="cp-profile">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem cargo</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-catalog">Linha de serviço</Label>
                <Select
                  value={draft.serviceCatalogId || "none"}
                  onValueChange={(v) => {
                    const item = catalog.find((c) => c.id === v);
                    setDraft((d) => ({
                      ...d,
                      serviceCatalogId: v === "none" ? "" : v,
                      defaultUnitPrice:
                        d.defaultUnitPrice > 0 ? d.defaultUnitPrice : Number(item?.base_price ?? 0),
                    }));
                  }}
                >
                  <SelectTrigger id="cp-catalog">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem linha de serviço</SelectItem>
                    {catalog.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cp-seniority">Senioridade</Label>
                <Select
                  value={draft.seniority || "none"}
                  onValueChange={(v) => setDraft({ ...draft, seniority: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="cp-seniority">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não se aplica</SelectItem>
                    {SENIORITY_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-unit">Unidade</Label>
                <Select
                  value={draft.unit}
                  onValueChange={(v) => setDraft({ ...draft, unit: v })}
                >
                  <SelectTrigger id="cp-unit">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Preço sugerido</Label>
                <CurrencyInput
                  currency={draft.currency}
                  value={draft.defaultUnitPrice}
                  onValueChange={(n) => setDraft({ ...draft, defaultUnitPrice: n ?? 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Custo sugerido</Label>
                <CurrencyInput
                  currency={draft.currency}
                  value={draft.defaultUnitCost}
                  onValueChange={(n) => setDraft({ ...draft, defaultUnitCost: n ?? 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-currency">Moeda</Label>
                <Input
                  id="cp-currency"
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-comp">Stack / competências (separadas por vírgula)</Label>
              <Input
                id="cp-comp"
                placeholder="React, Node, PostgreSQL"
                value={draft.competencies}
                onChange={(e) => setDraft({ ...draft, competencies: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-desc">Descrição</Label>
              <Textarea
                id="cp-desc"
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-notes">Observação interna</Label>
              <Textarea
                id="cp-notes"
                rows={2}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="cp-active"
                checked={draft.active}
                onCheckedChange={(v) => setDraft({ ...draft, active: v })}
              />
              <Label htmlFor="cp-active">Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
