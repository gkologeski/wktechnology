// Tela de migração assistida: classifica itens de linha legados de Negócios
// (texto livre) nas dimensões do catálogo — linha de serviço, cargo e
// senioridade. Nada é gravado sem aprovação explícita do usuário.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRightLeft, Check, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/crm";
import { SENIORITY_LABEL, SENIORITY_OPTIONS } from "@/lib/job-profiles-shared";
import { listCatalogServiceOptions } from "@/lib/services.functions";
import { listJobProfiles } from "@/lib/job-profiles.functions";
import {
  applyJobProfileMapping,
  applyLineItemMapping,
  listUnmappedLineItemNames,
  type UnmappedGroup,
} from "@/lib/catalog/line-item-migration.functions";
import {
  parseSeniority,
  suggestForName,
  suggestServiceForName,
} from "@/lib/catalog/line-item-classify";

type CatalogOption = { id: string; name: string; unit: string | null };
type JobProfileRow = {
  id: string;
  name: string;
  service_catalog_id: string | null;
  seniority: string | null;
};

type RowDraft = {
  serviceCatalogId: string | null;
  jobProfileId: string | null;
  seniority: string | null;
  approved: boolean;
};

const UNMAPPED_KEY = ["deal-line-items", "unmapped-names"] as const;

export function LineItemMigrationPage() {
  const qc = useQueryClient();
  const listUnmapped = useServerFn(listUnmappedLineItemNames);
  const listCatalog = useServerFn(listCatalogServiceOptions);
  const listProfiles = useServerFn(listJobProfiles);
  const applyMapping = useServerFn(applyLineItemMapping);
  const applyProfiles = useServerFn(applyJobProfileMapping);

  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [saving, setSaving] = useState(false);
  const [savingProfiles, setSavingProfiles] = useState(false);

  const {
    data: unmapped,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: UNMAPPED_KEY,
    queryFn: () =>
      listUnmapped() as unknown as Promise<{ groups: UnmappedGroup[]; totalItems: number }>,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog-service-options"],
    queryFn: () => listCatalog({ data: {} }) as Promise<CatalogOption[]>,
    staleTime: 60_000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["job_profiles"],
    queryFn: () => listProfiles({ data: {} }) as Promise<JobProfileRow[]>,
    staleTime: 60_000,
  });

  const groups = useMemo(() => unmapped?.groups ?? [], [unmapped]);
  const catalogName = useMemo(() => new Map(catalog.map((c) => [c.id, c.name])), [catalog]);
  const profileName = useMemo(() => new Map(profiles.map((p) => [p.id, p.name])), [profiles]);

  // Sugestões automáticas: recalculadas quando a lista, o catálogo ou os cargos
  // mudam, sem sobrescrever escolhas já feitas pelo usuário.
  useEffect(() => {
    if (groups.length === 0 || catalog.length === 0) return;
    setDrafts((current) => {
      const next = { ...current };
      let changed = false;
      for (const g of groups) {
        if (next[g.name]) continue;
        const s = suggestForName(g.name, catalog, profiles);
        next[g.name] = {
          serviceCatalogId: s.serviceCatalogId,
          jobProfileId: s.jobProfileId,
          seniority: s.seniority,
          approved: false,
        };
        changed = true;
      }
      return changed ? next : current;
    });
  }, [groups, catalog, profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  const approvedCount = filtered.filter(
    (g) => drafts[g.name]?.approved && drafts[g.name]?.serviceCatalogId,
  ).length;
  const readyCount = filtered.filter((g) => drafts[g.name]?.serviceCatalogId).length;

  function patch(name: string, p: Partial<RowDraft>) {
    setDrafts((c) => ({
      ...c,
      [name]: {
        ...{ serviceCatalogId: null, jobProfileId: null, seniority: null, approved: false },
        ...c[name],
        ...p,
      },
    }));
  }

  function approveAllSuggested() {
    setDrafts((c) => {
      const next = { ...c };
      for (const g of filtered) {
        const d = next[g.name];
        if (d?.serviceCatalogId) next[g.name] = { ...d, approved: true };
      }
      return next;
    });
  }

  async function applySelected() {
    const entries = filtered
      .filter((g) => drafts[g.name]?.approved && drafts[g.name]?.serviceCatalogId)
      .map((g) => {
        const d = drafts[g.name] as RowDraft;
        const unit = catalog.find((c) => c.id === d.serviceCatalogId)?.unit ?? null;
        return {
          name: g.name,
          serviceCatalogId: d.serviceCatalogId as string,
          jobProfileId: d.jobProfileId,
          seniority: d.seniority,
          unit,
        };
      });
    if (entries.length === 0) {
      toast.error("Aprove pelo menos um nome com linha de serviço definida.");
      return;
    }
    setSaving(true);
    try {
      const res = (await applyMapping({ data: { entries } })) as {
        updated: number;
        failures: Array<{ name: string; message: string }>;
      };
      toast.success(`${res.updated} item(ns) de linha classificado(s).`);
      if (res.failures.length > 0) {
        toast.error(`${res.failures.length} nome(s) falharam: ${res.failures[0]?.message ?? ""}`);
      }
      await qc.invalidateQueries({ queryKey: UNMAPPED_KEY });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Etapa 3 — cargos sem linha de serviço recebem a sugestão por palavra-chave.
  const profileSuggestions = useMemo(() => {
    return profiles
      .filter((p) => !p.service_catalog_id)
      .map((p) => {
        const serviceCatalogId = suggestServiceForName(p.name, catalog);
        const seniority = p.seniority ?? parseSeniority(p.name).seniority;
        return { id: p.id, name: p.name, serviceCatalogId, seniority };
      })
      .filter((p) => p.serviceCatalogId);
  }, [profiles, catalog]);

  async function applyProfileSuggestions() {
    if (profileSuggestions.length === 0) return;
    setSavingProfiles(true);
    try {
      const res = (await applyProfiles({
        data: {
          entries: profileSuggestions.slice(0, 500).map((p) => ({
            id: p.id,
            serviceCatalogId: p.serviceCatalogId as string,
            seniority: p.seniority,
          })),
        },
      })) as { updated: number; failures: Array<{ id: string; message: string }> };
      toast.success(`${res.updated} cargo(s) atualizado(s).`);
      await qc.invalidateQueries({ queryKey: ["job_profiles"] });
      await qc.invalidateQueries({ queryKey: ["job-profile-options"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingProfiles(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ArrowRightLeft aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-[240px] flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Migração de itens de linha para Serviços
          </h1>
          <p className="text-sm text-muted-foreground">
            Itens de Negócios criados como texto livre passam a apontar para a linha de serviço do
            catálogo, o cargo e a senioridade. Quantidades, preços, descontos e impostos não são
            alterados.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Nomes sem linha de serviço
            {unmapped ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                {groups.length} nome(s) · {unmapped.totalItems} item(ns)
              </span>
            ) : null}
          </CardTitle>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome do item…"
              className="max-w-md"
              aria-label="Buscar nome do item"
            />
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={approveAllSuggested}
                disabled={readyCount === 0}
              >
                <Check aria-hidden="true" className="mr-1 h-4 w-4" />
                Aprovar sugeridos ({readyCount})
              </Button>
              <Button size="sm" onClick={applySelected} disabled={saving || approvedCount === 0}>
                {saving ? "Aplicando…" : `Aplicar ${approvedCount} aprovado(s)`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar os itens de linha.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-md border bg-muted/40" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {groups.length === 0
                ? "Todos os itens de linha já estão vinculados a um serviço do catálogo."
                : "Nenhum nome encontrado com a busca atual."}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((g) => {
                const d = drafts[g.name];
                return (
                  <div key={g.name} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <Checkbox
                        checked={Boolean(d?.approved)}
                        onCheckedChange={(v) => patch(g.name, { approved: Boolean(v) })}
                        disabled={!d?.serviceCatalogId}
                        aria-label={`Aprovar mapeamento de ${g.name}`}
                        className="mt-1"
                      />
                      <div className="min-w-[220px] flex-1">
                        <p className="font-medium">{g.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                          {g.itemCount} item(ns) · {g.dealCount} negócio(s) ·{" "}
                          {formatCurrency(g.totalValue, "BRL")}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {d?.serviceCatalogId ? (
                            <Badge variant="outline" className="text-xs">
                              {catalogName.get(d.serviceCatalogId) ?? "Serviço"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Sem sugestão
                            </Badge>
                          )}
                          {d?.jobProfileId ? (
                            <Badge variant="outline" className="text-xs">
                              {profileName.get(d.jobProfileId) ?? "Cargo"}
                            </Badge>
                          ) : null}
                          {d?.seniority ? (
                            <Badge variant="secondary" className="text-xs">
                              {SENIORITY_LABEL[d.seniority] ?? d.seniority}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-3">
                        <div className="w-full sm:w-[220px]">
                          <Select
                            value={d?.serviceCatalogId ?? "none"}
                            onValueChange={(v) =>
                              patch(g.name, {
                                serviceCatalogId: v === "none" ? null : v,
                                approved: v === "none" ? false : d?.approved,
                              })
                            }
                          >
                            <SelectTrigger aria-label={`Linha de serviço de ${g.name}`}>
                              <SelectValue placeholder="Linha de serviço" />
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
                        <div className="w-full sm:w-[220px]">
                          <EntityCombobox
                            entity="job_profiles"
                            select="id, name, seniority"
                            searchColumns={["name"]}
                            filters={{ active: true }}
                            labelFrom={(r) => String((r as { name?: string }).name ?? "Cargo")}
                            value={d?.jobProfileId ?? null}
                            onChange={(id) => patch(g.name, { jobProfileId: id })}
                            placeholder={
                              d?.jobProfileId
                                ? (profileName.get(d.jobProfileId) ?? "Cargo (opcional)")
                                : "Cargo (opcional)"
                            }
                            emptyLabel="Nenhum cargo"
                          />
                        </div>
                        <div className="w-full sm:w-[160px]">
                          <Select
                            value={d?.seniority ?? "none"}
                            onValueChange={(v) =>
                              patch(g.name, { seniority: v === "none" ? null : v })
                            }
                          >
                            <SelectTrigger aria-label={`Senioridade de ${g.name}`}>
                              <SelectValue placeholder="Senioridade" />
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cargos sem linha de serviço</CardTitle>
          <p className="text-sm text-muted-foreground">
            Preencher a linha de serviço do cargo faz novos negócios já sugerirem o serviço correto
            ao escolher o cargo.
          </p>
        </CardHeader>
        <CardContent>
          {profileSuggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma sugestão pendente para os cargos cadastrados.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                {profileSuggestions.length} cargo(s) com sugestão de linha de serviço.
              </p>
              <div className="flex flex-wrap gap-1">
                {profileSuggestions.slice(0, 12).map((p) => (
                  <Badge key={p.id} variant="outline" className="text-xs">
                    {p.name} → {catalogName.get(p.serviceCatalogId as string) ?? "Serviço"}
                  </Badge>
                ))}
                {profileSuggestions.length > 12 ? (
                  <Badge variant="secondary" className="text-xs">
                    +{profileSuggestions.length - 12}
                  </Badge>
                ) : null}
              </div>
              <Button size="sm" onClick={applyProfileSuggestions} disabled={savingProfiles}>
                <Wand2 aria-hidden="true" className="mr-1 h-4 w-4" />
                {savingProfiles ? "Aplicando…" : "Aplicar sugestões aos cargos"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
