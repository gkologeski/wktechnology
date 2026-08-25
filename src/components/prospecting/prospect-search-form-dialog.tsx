import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MultiSelectChips } from "@/components/ui/multi-select-chips";
import { MultiSelectOptions } from "@/components/ui/multi-select-options";
import { AutocompleteChips } from "@/components/ui/autocomplete-chips";
import {
  DEPARTMENT_OPTIONS,
  EMAIL_STATUS_OPTIONS,
  EMPLOYEE_RANGE_OPTIONS,
  INDUSTRY_OPTIONS,
  ProspectFilters,
  REVENUE_RANGE_OPTIONS,
  SENIORITY_OPTIONS,
  countActiveFilters,
} from "@/lib/prospecting-options";

const STORAGE_KEY = "prospect-search-form:showAdvanced";

export type ProspectSearchFormValue = {
  id?: string | null;
  name: string;
  filters: ProspectFilters;
  instructions: string;
  max_results: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ProspectSearchFormValue | null;
  onSubmit: (value: ProspectSearchFormValue) => Promise<void> | void;
  submitting?: boolean;
};

const emptyValue: ProspectSearchFormValue = {
  name: "",
  filters: {},
  instructions: "",
  max_results: 10,
};

export function ProspectSearchFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  submitting,
}: Props) {
  const [value, setValue] = useState<ProspectSearchFormValue>(emptyValue);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initial ?? emptyValue);
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setShowAdvanced(stored === "1");
      } catch {
        /* noop */
      }
    }
  }, [open, initial]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, showAdvanced ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [showAdvanced]);

  const setFilter = <K extends keyof ProspectFilters>(key: K, next: ProspectFilters[K]) => {
    setValue((v) => ({ ...v, filters: { ...v.filters, [key]: next } }));
  };

  const advancedKeys: (keyof ProspectFilters)[] = [
    "person_departments",
    "person_not_titles",
    "organization_locations",
    "organization_estimated_annual_revenue_ranges",
    "organization_technology_uids",
    "q_organization_keyword_tags",
    "contact_email_status",
    "organization_domains",
    "organization_not_domains",
  ];

  const advancedCount = useMemo(
    () =>
      advancedKeys.reduce(
        (n, k) => n + ((value.filters[k] as string[] | undefined)?.length ? 1 : 0),
        0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value.filters],
  );

  const totalCount = countActiveFilters(value.filters);
  const canSubmit = value.name.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    await onSubmit(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {value.id ? "Editar busca de prospects" : "Nova busca de prospects"}
            {totalCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalCount} filtro{totalCount === 1 ? "" : "s"} ativo{totalCount === 1 ? "" : "s"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label>Nome da busca</Label>
            <Input
              value={value.name}
              onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))}
              placeholder="Ex.: SaaS B2B – Diretores comerciais SP"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Nome interno para identificar esta busca na lista.
            </p>
          </div>

          <section className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Filtros básicos</h3>
              <span className="text-xs text-muted-foreground">
                Campos mais usados para uma busca rápida
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Cargos alvo</Label>
                <MultiSelectChips
                  value={value.filters.person_titles ?? []}
                  onChange={(v) => setFilter("person_titles", v)}
                  placeholder="Ex.: CEO, CTO, Diretor Comercial"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter, Tab ou vírgula para adicionar. A base do Apollo é majoritariamente em
                  inglês — prefira CTO, Head of IT, Sales Director.
                </p>
              </div>

              <div>
                <Label>Localizações</Label>
                <MultiSelectChips
                  value={value.filters.person_locations ?? []}
                  onChange={(v) => setFilter("person_locations", v)}
                  placeholder="Ex.: São Paulo, Brazil"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Cidade, estado ou país da pessoa.
                </p>
              </div>

              <div>
                <Label>Senioridade</Label>
                <MultiSelectOptions
                  value={value.filters.person_seniorities ?? []}
                  onChange={(v) => setFilter("person_seniorities", v)}
                  options={SENIORITY_OPTIONS}
                  placeholder="Todas as senioridades"
                />
              </div>

              <div>
                <Label>Setor / Indústria</Label>
                <AutocompleteChips
                  value={value.filters.organization_industry_keywords ?? []}
                  onChange={(v) => setFilter("organization_industry_keywords", v)}
                  options={INDUSTRY_OPTIONS}
                  placeholder="Digite para buscar (ex.: software, saúde, varejo)"
                  emptyLabel="Nenhum setor encontrado"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comece a digitar e escolha um setor da lista do Apollo. Setores e palavras-chave
                  são combinados com OU.
                </p>
              </div>

              <div>
                <Label>Porte da empresa</Label>
                <MultiSelectOptions
                  value={value.filters.organization_num_employees_ranges ?? []}
                  onChange={(v) => setFilter("organization_num_employees_ranges", v)}
                  options={EMPLOYEE_RANGE_OPTIONS}
                  placeholder="Todos os portes"
                />
              </div>

              <div>
                <Label>Palavras-chave</Label>
                <MultiSelectChips
                  value={value.filters.q_keywords ?? []}
                  onChange={(v) => setFilter("q_keywords", v)}
                  placeholder="Ex.: software, fintech, logistics"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Termos aplicados à empresa (OU entre eles). Termos em português retornam poucos
                  resultados.
                </p>
              </div>
            </div>
          </section>

          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-between"
              onClick={() => setShowAdvanced((s) => !s)}
            >
              <span className="flex items-center gap-2">
                {showAdvanced ? "Ocultar filtros avançados" : "Mostrar todos os filtros"}
                {advancedCount > 0 && <Badge variant="secondary">{advancedCount}</Badge>}
              </span>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {showAdvanced && (
            <section className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium text-sm">Filtros avançados</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Departamentos</Label>
                  <MultiSelectOptions
                    value={value.filters.person_departments ?? []}
                    onChange={(v) => setFilter("person_departments", v)}
                    options={DEPARTMENT_OPTIONS}
                    placeholder="Todos os departamentos"
                  />
                </div>

                <div>
                  <Label>Excluir cargos</Label>
                  <MultiSelectChips
                    value={value.filters.person_not_titles ?? []}
                    onChange={(v) => setFilter("person_not_titles", v)}
                    placeholder="Ex.: Assistente, Estagiário"
                  />
                </div>

                <div>
                  <Label>Localização da empresa</Label>
                  <MultiSelectChips
                    value={value.filters.organization_locations ?? []}
                    onChange={(v) => setFilter("organization_locations", v)}
                    placeholder="Ex.: Brazil, United States"
                  />
                </div>

                <div>
                  <Label>Faixa de receita anual</Label>
                  <MultiSelectOptions
                    value={value.filters.organization_estimated_annual_revenue_ranges ?? []}
                    onChange={(v) => setFilter("organization_estimated_annual_revenue_ranges", v)}
                    options={REVENUE_RANGE_OPTIONS}
                    placeholder="Todas as faixas"
                  />
                </div>

                <div>
                  <Label>Tecnologias usadas</Label>
                  <MultiSelectChips
                    value={value.filters.organization_technology_uids ?? []}
                    onChange={(v) => setFilter("organization_technology_uids", v)}
                    placeholder="Ex.: salesforce, hubspot, aws"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Slugs de tecnologia do Apollo (minúsculo, separados por vírgula).
                  </p>
                </div>

                <div>
                  <Label>Status de e-mail</Label>
                  <MultiSelectOptions
                    value={value.filters.contact_email_status ?? []}
                    onChange={(v) => setFilter("contact_email_status", v)}
                    options={EMAIL_STATUS_OPTIONS}
                    placeholder="Qualquer status"
                  />
                </div>

                <div>
                  <Label>Tags da empresa</Label>
                  <MultiSelectChips
                    value={value.filters.q_organization_keyword_tags ?? []}
                    onChange={(v) => setFilter("q_organization_keyword_tags", v)}
                    placeholder="Ex.: b2b, remote-first"
                  />
                </div>

                <div>
                  <Label>Domínios permitidos</Label>
                  <MultiSelectChips
                    value={value.filters.organization_domains ?? []}
                    onChange={(v) => setFilter("organization_domains", v)}
                    placeholder="Ex.: acme.com, contoso.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Excluir domínios</Label>
                  <MultiSelectChips
                    value={value.filters.organization_not_domains ?? []}
                    onChange={(v) => setFilter("organization_not_domains", v)}
                    placeholder="Ex.: concorrente.com"
                  />
                </div>
              </div>
            </section>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label>Instruções extras</Label>
              <Textarea
                rows={2}
                value={value.instructions}
                onChange={(e) => setValue((v) => ({ ...v, instructions: e.target.value }))}
                placeholder="Contexto adicional para a triagem interna (opcional)."
              />
            </div>
            <div>
              <Label>Máx. resultados</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={value.max_results}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    max_results: Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 10)),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">Entre 1 e 50 por execução.</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? "Salvando..." : "Salvar busca"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
