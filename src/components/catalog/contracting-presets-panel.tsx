// Painel de Presets de Contratação (contracting_presets).
// Extraído da tela /catalog/contracting-presets para virar aba da central
// unificada "Presets e Cargos". Acrescenta, sem alterar schema ou regra:
// - criação rápida de cargo dentro do seletor do preset;
// - visualização opcional agrupada por cargo;
// - indicador de margem bruta estimada (preço x custo).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/crm";
import { SENIORITY_LABEL, SENIORITY_OPTIONS } from "@/lib/job-profiles-shared";
import {
  createContractingPreset,
  deleteContractingPreset,
  duplicateContractingPreset,
  listContractingPresets,
  updateContractingPreset,
} from "@/lib/contracting-presets.functions";
import { createJobProfile, listJobProfileOptions } from "@/lib/job-profiles.functions";
import { listCatalogServiceOptions } from "@/lib/services.functions";

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

export function marginPercent(price: number, cost: number): number | null {
  if (!(price > 0) || !(cost > 0)) return null;
  return ((price - cost) / price) * 100;
}

function MarginBadge({ price, cost }: { price: number; cost: number }) {
  const pct = marginPercent(price, cost);
  if (pct === null) return null;
  const tone =
    pct >= 30
      ? "border-status-open/40 text-status-open"
      : pct >= 15
        ? "border-status-onhold/40 text-status-onhold"
        : "border-destructive/40 text-destructive";
  return (
    <Badge variant="outline" className={cn("text-xs tabular-nums", tone)}>
      Margem {pct.toFixed(0)}%
    </Badge>
  );
}

export function ContractingPresetsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listContractingPresets);
  const create = useServerFn(createContractingPreset);
  const update = useServerFn(updateContractingPreset);
  const remove = useServerFn(deleteContractingPreset);
  const dup = useServerFn(duplicateContractingPreset);
  const listCatalog = useServerFn(listCatalogServiceOptions);
  const listProfiles = useServerFn(listJobProfileOptions);
  const createProfile = useServerFn(createJobProfile);

  const [search, setSearch] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [grouped, setGrouped] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Preset | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  // Combobox de cargo com criação rápida.
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileQuery, setProfileQuery] = useState("");
  const [creatingProfile, setCreatingProfile] = useState(false);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);

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

  const groups = useMemo(() => {
    if (!grouped) return null;
    const map = new Map<string, { label: string; items: Preset[] }>();
    for (const r of filtered) {
      const key = r.job_profile_id ?? "__none__";
      const label = r.job_profile_id
        ? (profileName.get(r.job_profile_id) ?? "Cargo removido")
        : "Sem cargo definido";
      const bucket = map.get(key) ?? { label, items: [] };
      bucket.items.push(r);
      map.set(key, bucket);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [grouped, filtered, profileName]);

  useEffect(() => {
    if (!open) return;
    setProfileQuery("");
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
  function applyProfile(profile: ProfileOption | undefined, id: string) {
    setDraft((d) => {
      const next: Draft = { ...d, jobProfileId: id };
      if (!profile) return next;
      if (profile.seniority && !d.seniority) next.seniority = profile.seniority;
      if ((profile.competencies ?? []).length > 0 && !d.competencies.trim())
        next.competencies = (profile.competencies ?? []).join(", ");
      if (profile.service_catalog_id && !d.serviceCatalogId)
        next.serviceCatalogId = profile.service_catalog_id;
      if (Number(profile.default_unit_price) > 0 && !(d.defaultUnitPrice > 0))
        next.defaultUnitPrice = Number(profile.default_unit_price);
      return next;
    });
  }

  function pickProfile(value: string) {
    if (value === "none") {
      setDraft((d) => ({ ...d, jobProfileId: "" }));
    } else {
      applyProfile(
        profiles.find((x) => x.id === value),
        value,
      );
    }
    setProfileOpen(false);
    profileTriggerRef.current?.focus();
  }

  async function quickCreateProfile() {
    const name = profileQuery.trim();
    if (!name) return;
    setCreatingProfile(true);
    try {
      const created = (await createProfile({
        data: {
          name,
          code: null,
          description: null,
          serviceCatalogId: draft.serviceCatalogId || null,
          seniority: (draft.seniority || null) as never,
          defaultUnitPrice: 0,
          currency: draft.currency || "BRL",
          competencies: [],
          active: true,
        },
      })) as { id?: string } | null;
      await qc.invalidateQueries({ queryKey: ["job-profile-options"] });
      await qc.invalidateQueries({ queryKey: ["job_profiles"] });
      if (created?.id) setDraft((d) => ({ ...d, jobProfileId: created.id as string }));
      toast.success(`Cargo “${name}” criado e selecionado.`);
      setProfileOpen(false);
      setProfileQuery("");
      profileTriggerRef.current?.focus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreatingProfile(false);
    }
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

  const profileMatches = useMemo(() => {
    const q = profileQuery.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => p.name.toLowerCase().includes(q));
  }, [profiles, profileQuery]);

  const exactProfile = useMemo(
    () =>
      profiles.some((p) => p.name.trim().toLowerCase() === profileQuery.trim().toLowerCase()) ||
      !profileQuery.trim(),
    [profiles, profileQuery],
  );

  function renderRow(r: Preset) {
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
            {!grouped && r.job_profile_id ? (
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
            <MarginBadge price={Number(r.default_unit_price)} cost={Number(r.default_unit_cost)} />
            {!r.active ? (
              <Badge variant="secondary" className="text-xs">
                Inativo
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs tabular-nums text-muted-foreground">
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
    );
  }

  const selectedProfileLabel = draft.jobProfileId
    ? (profileName.get(draft.jobProfileId) ?? "Cargo selecionado")
    : "Sem cargo";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por nome, código ou stack…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
          aria-label="Buscar presets"
        />
        <Select value={catalogFilter} onValueChange={setCatalogFilter}>
          <SelectTrigger className="sm:w-[240px]" aria-label="Filtrar por linha de serviço">
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
        <div className="flex items-center gap-2 sm:ml-auto">
          <ToggleGroup
            type="single"
            value={grouped ? "grouped" : "flat"}
            onValueChange={(v) => {
              if (v) setGrouped(v === "grouped");
            }}
            aria-label="Modo de visualização dos presets"
          >
            <ToggleGroupItem value="flat" aria-label="Ver em lista">
              Lista
            </ToggleGroupItem>
            <ToggleGroupItem value="grouped" aria-label="Agrupar por cargo">
              Por cargo
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus aria-hidden="true" className="mr-1 h-4 w-4" /> Novo preset
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar os presets.</p>
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
            ? "Nenhum preset cadastrado. Comece criando “Dev React Sênior” ou “Assistente Financeiro Pleno”."
            : "Nenhum preset encontrado com os filtros atuais."}
        </div>
      ) : groups ? (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.label} className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                {g.label}
                <Badge variant="outline" className="text-xs">
                  {g.items.length === 1 ? "1 preset" : `${g.items.length} presets`}
                </Badge>
              </h3>
              <div className="space-y-2">{g.items.map(renderRow)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-2">{filtered.map(renderRow)}</div>
      )}

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
                <Popover open={profileOpen} onOpenChange={setProfileOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="cp-profile"
                      ref={profileTriggerRef}
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={profileOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">{selectedProfileLabel}</span>
                      <ChevronsUpDown aria-hidden="true" className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar ou digitar novo cargo…"
                        value={profileQuery}
                        onValueChange={setProfileQuery}
                      />
                      <CommandList>
                        {profileMatches.length === 0 && exactProfile ? (
                          <CommandEmpty>Nenhum cargo encontrado.</CommandEmpty>
                        ) : null}
                        {!exactProfile ? (
                          <CommandGroup heading="Criar">
                            <CommandItem
                              value="__create__"
                              disabled={creatingProfile}
                              onSelect={quickCreateProfile}
                            >
                              <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                              {creatingProfile
                                ? "Criando cargo…"
                                : `Criar cargo “${profileQuery.trim()}”`}
                            </CommandItem>
                          </CommandGroup>
                        ) : null}
                        <CommandGroup heading="Cargos">
                          <CommandItem value="none" onSelect={() => pickProfile("none")}>
                            <Check
                              aria-hidden="true"
                              className={cn(
                                "mr-2 h-4 w-4",
                                draft.jobProfileId ? "opacity-0" : "opacity-100",
                              )}
                            />
                            Sem cargo
                          </CommandItem>
                          {profileMatches.map((p) => (
                            <CommandItem key={p.id} value={p.id} onSelect={() => pickProfile(p.id)}>
                              <Check
                                aria-hidden="true"
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  draft.jobProfileId === p.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span className="truncate">{p.name}</span>
                              {p.seniority ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {SENIORITY_LABEL[p.seniority] ?? p.seniority}
                                </span>
                              ) : null}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Digite um nome novo para cadastrar o cargo sem sair desta janela.
                </p>
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
                <Select value={draft.unit} onValueChange={(v) => setDraft({ ...draft, unit: v })}>
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

            {marginPercent(draft.defaultUnitPrice, draft.defaultUnitCost) !== null ? (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Margem bruta estimada:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {marginPercent(draft.defaultUnitPrice, draft.defaultUnitCost)?.toFixed(0)}%
                </span>
              </p>
            ) : null}

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
