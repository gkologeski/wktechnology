// Painel de Cargos e Perfis (job_profiles).
// Extraído da antiga tela /catalog/job-profiles para ser reutilizado como aba
// da central unificada "Presets e Cargos" (/catalog/contracting-presets).
// Puramente de apresentação + queries da própria entidade (sem regra nova).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  createJobProfile,
  deleteJobProfile,
  listJobProfiles,
  updateJobProfile,
} from "@/lib/job-profiles.functions";
import { listCatalogServiceOptions } from "@/lib/services.functions";

type JobProfile = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  service_catalog_id: string | null;
  seniority: string | null;
  default_unit_price: number;
  currency: string;
  competencies: string[];
  tags: string[];
  active: boolean;
};

type CatalogOption = { id: string; name: string; unit: string; base_price: number };

type Draft = {
  name: string;
  code: string;
  description: string;
  serviceCatalogId: string;
  seniority: string;
  defaultUnitPrice: number;
  currency: string;
  competencies: string;
  active: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  code: "",
  description: "",
  serviceCatalogId: "",
  seniority: "",
  defaultUnitPrice: 0,
  currency: "BRL",
  competencies: "",
  active: true,
};

export function JobProfilesPanel({
  presetCountByProfile,
}: {
  /** Quantidade de presets vinculados por cargo (apenas exibição). */
  presetCountByProfile?: Map<string, number>;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listJobProfiles);
  const create = useServerFn(createJobProfile);
  const update = useServerFn(updateJobProfile);
  const remove = useServerFn(deleteJobProfile);
  const listCatalog = useServerFn(listCatalogServiceOptions);

  const [search, setSearch] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobProfile | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["job_profiles"],
    queryFn: () => list({ data: {} }) as Promise<JobProfile[]>,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog-service-options"],
    queryFn: () => listCatalog({ data: {} }) as Promise<CatalogOption[]>,
    staleTime: 60_000,
  });

  const catalogName = useMemo(() => new Map(catalog.map((c) => [c.id, c.name])), [catalog]);

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
        seniority: editing.seniority ?? "",
        defaultUnitPrice: Number(editing.default_unit_price ?? 0),
        currency: editing.currency ?? "BRL",
        competencies: (editing.competencies ?? []).join(", "),
        active: editing.active,
      });
    } else {
      setDraft(EMPTY_DRAFT);
    }
  }, [open, editing]);

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Informe o nome do cargo.");
      return;
    }
    setSaving(true);
    const payload = {
      name: draft.name,
      code: draft.code || null,
      description: draft.description || null,
      serviceCatalogId: draft.serviceCatalogId || null,
      seniority: (draft.seniority || null) as never,
      defaultUnitPrice: Number(draft.defaultUnitPrice ?? 0),
      currency: draft.currency || "BRL",
      competencies: draft.competencies
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      active: draft.active,
    };
    try {
      if (editing) await update({ data: { id: editing.id, patch: payload } });
      else await create({ data: payload });
      toast.success(editing ? "Cargo atualizado." : "Cargo criado.");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["job_profiles"] });
      await qc.invalidateQueries({ queryKey: ["job-profile-options"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: JobProfile, active: boolean) {
    try {
      await update({ data: { id: r.id, patch: { active } } });
      await qc.invalidateQueries({ queryKey: ["job_profiles"] });
      await qc.invalidateQueries({ queryKey: ["job-profile-options"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function destroy(r: JobProfile) {
    if (!(await confirmDialog(`Excluir o cargo “${r.name}”?`))) return;
    try {
      await remove({ data: { id: r.id } });
      toast.success("Cargo excluído.");
      await qc.invalidateQueries({ queryKey: ["job_profiles"] });
      await qc.invalidateQueries({ queryKey: ["job-profile-options"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por nome, código ou competência…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
          aria-label="Buscar cargos"
        />
        <Select value={catalogFilter} onValueChange={setCatalogFilter}>
          <SelectTrigger className="sm:w-[240px]" aria-label="Filtrar cargos por linha de serviço">
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
        <div className="sm:ml-auto">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus aria-hidden="true" className="mr-1 h-4 w-4" /> Novo cargo
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar os cargos.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-md border border-border-subtle bg-muted/40"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "Nenhum cargo cadastrado. Comece criando “Assistente Financeiro”, “Coordenador de RH” ou “Desenvolvedor Full Stack”."
            : "Nenhum cargo encontrado com os filtros atuais."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const usage = presetCountByProfile?.get(r.id) ?? 0;
            return (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border-subtle p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    {r.code ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {r.code}
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
                    {usage > 0 ? (
                      <Badge variant="outline" className="text-xs">
                        {usage === 1 ? "1 preset" : `${usage} presets`}
                      </Badge>
                    ) : null}
                    {!r.active ? (
                      <Badge variant="secondary" className="text-xs">
                        Inativo
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs tabular-nums text-muted-foreground">
                    {Number(r.default_unit_price) > 0 ? (
                      <span>
                        Preço padrão {formatCurrency(Number(r.default_unit_price), r.currency)}
                      </span>
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
                    aria-label={r.active ? "Desativar cargo" : "Ativar cargo"}
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
                    onClick={() => destroy(r)}
                    aria-label={`Excluir ${r.name}`}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cargo" : "Novo cargo"}</DialogTitle>
            <DialogDescription>
              O cargo é usado nos serviços do contrato para dizer para qual função a prestadora foi
              contratada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="jp-name">Nome do cargo *</Label>
                <Input
                  id="jp-name"
                  placeholder="Assistente Financeiro, Coordenador de RH…"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jp-code">Código</Label>
                <Input
                  id="jp-code"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="jp-catalog">Linha de serviço</Label>
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
                  <SelectTrigger id="jp-catalog">
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
              <div className="space-y-1.5">
                <Label htmlFor="jp-seniority">Senioridade</Label>
                <Select
                  value={draft.seniority || "none"}
                  onValueChange={(v) => setDraft({ ...draft, seniority: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="jp-seniority">
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
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Preço padrão</Label>
                <CurrencyInput
                  currency={draft.currency}
                  value={draft.defaultUnitPrice}
                  onValueChange={(n) => setDraft({ ...draft, defaultUnitPrice: n ?? 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jp-currency">Moeda</Label>
                <Input
                  id="jp-currency"
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="jp-comp">Stack / competências (separadas por vírgula)</Label>
              <Input
                id="jp-comp"
                placeholder="React, Node, PostgreSQL"
                value={draft.competencies}
                onChange={(e) => setDraft({ ...draft, competencies: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="jp-desc">Descrição</Label>
              <Textarea
                id="jp-desc"
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="jp-active"
                checked={draft.active}
                onCheckedChange={(v) => setDraft({ ...draft, active: v })}
              />
              <Label htmlFor="jp-active">Ativo</Label>
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
