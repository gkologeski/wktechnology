import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Linkedin, Search, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getLinkedinJobConfig,
  updateLinkedinJobConfig,
  searchLinkedinDirectory,
} from "@/lib/ats/linkedin-job-config.functions";
import { AtsSectionHeader } from "@/components/ats/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Config = {
  linkedin_company_id: string | null;
  linkedin_company_name: string | null;
  linkedin_location_id: string | null;
  linkedin_location_name: string | null;
  linkedin_workplace: "REMOTE" | "HYBRID" | "ON_SITE" | null;
  linkedin_employment_status:
    | "FULL_TIME"
    | "PART_TIME"
    | "CONTRACT"
    | "INTERNSHIP"
    | "TEMPORARY"
    | "VOLUNTEER"
    | "OTHER"
    | null;
  linkedin_apply_type: "linkedin" | "external" | null;
  linkedin_apply_url: string | null;
  linkedin_notification_email: string | null;
  linkedin_publish_mode: "FREE" | "PROMOTED" | null;
  linkedin_budget_period: "total" | "daily" | null;
  linkedin_budget_amount: number | null;
  linkedin_budget_currency: string | null;
};

const EMPTY: Config = {
  linkedin_company_id: null,
  linkedin_company_name: null,
  linkedin_location_id: null,
  linkedin_location_name: null,
  linkedin_workplace: null,
  linkedin_employment_status: null,
  linkedin_apply_type: "linkedin",
  linkedin_apply_url: null,
  linkedin_notification_email: null,
  linkedin_publish_mode: "FREE",
  linkedin_budget_period: "total",
  linkedin_budget_amount: null,
  linkedin_budget_currency: "BRL",
};

const PUBLISH_MODE_LABEL: Record<string, string> = {
  FREE: "Gratuito (Job Slot)",
  PROMOTED: "Promovido (pago)",
};
const BUDGET_PERIOD_LABEL: Record<string, string> = {
  total: "Orçamento total",
  daily: "Orçamento diário",
};
const CURRENCIES = ["BRL", "USD", "EUR"];

const WORKPLACE_LABEL: Record<string, string> = {
  REMOTE: "Remoto",
  HYBRID: "Híbrido",
  ON_SITE: "Presencial",
};
const EMPLOYMENT_LABEL: Record<string, string> = {
  FULL_TIME: "Tempo integral",
  PART_TIME: "Meio período",
  CONTRACT: "Contrato",
  INTERNSHIP: "Estágio",
  TEMPORARY: "Temporário",
  VOLUNTEER: "Voluntário",
  OTHER: "Outro",
};

export function LinkedinJobConfigPanel({ jobId }: { jobId: string }) {
  const getCfg = useServerFn(getLinkedinJobConfig);
  const saveCfg = useServerFn(updateLinkedinJobConfig);
  const search = useServerFn(searchLinkedinDirectory);

  const [cfg, setCfg] = useState<Config>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const rest = (await getCfg({ data: { job_id: jobId } })) as Partial<Config>;
        setCfg({
          ...EMPTY,
          ...rest,
          linkedin_budget_amount:
            rest.linkedin_budget_amount == null ? null : Number(rest.linkedin_budget_amount),
        });
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId, getCfg]);

  const update = useCallback((patch: Partial<Config>) => {
    setCfg((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await saveCfg({ data: { job_id: jobId, ...cfg } });
      toast.success("Configuração LinkedIn salva");
      setDirty(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const ready =
    Boolean(cfg.linkedin_company_id) &&
    Boolean(cfg.linkedin_location_id) &&
    Boolean(cfg.linkedin_workplace) &&
    Boolean(cfg.linkedin_employment_status) &&
    ((cfg.linkedin_apply_type ?? "linkedin") === "linkedin"
      ? Boolean(cfg.linkedin_notification_email)
      : Boolean(cfg.linkedin_apply_url));

  const promoted = (cfg.linkedin_publish_mode ?? "FREE") === "PROMOTED";

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4 space-y-3">
      <AtsSectionHeader
        title="Publicação no LinkedIn"
        description="Configure Company Page, localização e método de candidatura para publicar via Unipile."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div
            className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
              ready
                ? "border-status-open/30 bg-status-open/5 text-status-open"
                : "border-risk-medium/30 bg-risk-medium/5 text-risk-medium"
            }`}
          >
            {ready ? (
              <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
            )}
            <span>
              {ready
                ? "Pronto para publicar. LinkedIn consome créditos de Job Slot da conta conectada."
                : "Preencha os campos abaixo para habilitar a publicação no LinkedIn."}
            </span>
          </div>

          <DirectoryPicker
            label="Company Page (LinkedIn)"
            placeholder="Buscar empresa por nome…"
            type="COMPANY"
            selectedId={cfg.linkedin_company_id}
            selectedTitle={cfg.linkedin_company_name}
            onSelect={(id, title) =>
              update({ linkedin_company_id: id, linkedin_company_name: title })
            }
            search={(kw) => search({ data: { type: "COMPANY", keywords: kw } })}
          />

          <DirectoryPicker
            label="Localização"
            placeholder="Ex.: São Paulo, Brasil…"
            type="LOCATION"
            selectedId={cfg.linkedin_location_id}
            selectedTitle={cfg.linkedin_location_name}
            onSelect={(id, title) =>
              update({ linkedin_location_id: id, linkedin_location_name: title })
            }
            search={(kw) => search({ data: { type: "LOCATION", keywords: kw } })}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-text-tertiary">Modalidade</Label>
              <Select
                value={cfg.linkedin_workplace ?? ""}
                onValueChange={(v) =>
                  update({ linkedin_workplace: v as Config["linkedin_workplace"] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WORKPLACE_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-text-tertiary">Vínculo</Label>
              <Select
                value={cfg.linkedin_employment_status ?? ""}
                onValueChange={(v) =>
                  update({
                    linkedin_employment_status: v as Config["linkedin_employment_status"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYMENT_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-text-tertiary">Método de candidatura</Label>
            <RadioGroup
              value={cfg.linkedin_apply_type ?? "linkedin"}
              onValueChange={(v) => update({ linkedin_apply_type: v as "linkedin" | "external" })}
              className="flex gap-4 mt-1"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="linkedin" /> LinkedIn (Easy Apply)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="external" /> URL externa
              </label>
            </RadioGroup>
          </div>

          {(cfg.linkedin_apply_type ?? "linkedin") === "linkedin" ? (
            <div>
              <Label className="text-xs text-text-tertiary">
                Email para notificar candidaturas
              </Label>
              <Input
                type="email"
                value={cfg.linkedin_notification_email ?? ""}
                onChange={(e) => update({ linkedin_notification_email: e.target.value || null })}
                placeholder="recrutamento@empresa.com"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs text-text-tertiary">URL da candidatura externa</Label>
              <Input
                type="url"
                value={cfg.linkedin_apply_url ?? ""}
                onChange={(e) => update({ linkedin_apply_url: e.target.value || null })}
                placeholder="https://empresa.com/vagas/xyz"
              />
            </div>
          )}

          <div className="space-y-2 rounded-md border border-border-subtle bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium text-text-secondary">
                Fluxo de publicação (rascunho → publicação → fechamento)
              </Label>
              <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-tertiary">
                API v2
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-text-tertiary" htmlFor="li-publish-mode">
                  Modo de publicação
                </Label>
                <Select
                  value={cfg.linkedin_publish_mode ?? "FREE"}
                  onValueChange={(v) =>
                    update({ linkedin_publish_mode: v as Config["linkedin_publish_mode"] })
                  }
                >
                  <SelectTrigger id="li-publish-mode" aria-label="Modo de publicação">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PUBLISH_MODE_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-text-tertiary" htmlFor="li-budget-period">
                  Período do orçamento
                </Label>
                <Select
                  value={cfg.linkedin_budget_period ?? "total"}
                  onValueChange={(v) =>
                    update({ linkedin_budget_period: v as Config["linkedin_budget_period"] })
                  }
                  disabled={!promoted}
                >
                  <SelectTrigger id="li-budget-period" aria-label="Período do orçamento">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BUDGET_PERIOD_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-text-tertiary" htmlFor="li-budget-amount">
                  Valor do orçamento
                </Label>
                <Input
                  id="li-budget-amount"
                  type="number"
                  min={1}
                  step="0.01"
                  inputMode="decimal"
                  disabled={!promoted}
                  value={cfg.linkedin_budget_amount ?? ""}
                  onChange={(e) =>
                    update({
                      linkedin_budget_amount: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="Ex.: 500"
                />
              </div>
              <div>
                <Label className="text-xs text-text-tertiary" htmlFor="li-budget-currency">
                  Moeda
                </Label>
                <Select
                  value={cfg.linkedin_budget_currency ?? "BRL"}
                  onValueChange={(v) => update({ linkedin_budget_currency: v })}
                  disabled={!promoted}
                >
                  <SelectTrigger id="li-budget-currency" aria-label="Moeda do orçamento">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {promoted && !cfg.linkedin_budget_amount ? (
              <p className="text-xs text-risk-medium">
                Informe um valor de orçamento para publicar como promovida.
              </p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={onSave}
              disabled={!dirty || saving || (promoted && !cfg.linkedin_budget_amount)}
              size="sm"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Linkedin className="h-3.5 w-3.5 mr-1.5" aria-hidden />
              )}
              Salvar configuração
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function DirectoryPicker({
  label,
  placeholder,
  selectedId,
  selectedTitle,
  onSelect,
  search,
}: {
  label: string;
  placeholder: string;
  type: "COMPANY" | "LOCATION";
  selectedId: string | null;
  selectedTitle: string | null;
  onSelect: (id: string, title: string) => void;
  search: (
    kw: string,
  ) => Promise<{ items: Array<{ id: string; title: string }>; connected: boolean; error?: string }>;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [notConnected, setNotConnected] = useState(false);

  const doSearch = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const r = await search(q.trim());
      setNotConnected(!r.connected);
      setItems(r.items);
      if (r.error) toast.error(r.error);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Label className="text-xs text-text-tertiary">{label}</Label>
      {selectedId && (
        <div className="text-xs text-text-secondary mb-1 flex items-center gap-2">
          <Check className="h-3 w-3 text-status-open" aria-hidden />
          <span className="font-mono">{selectedId}</span>
          {selectedTitle && <span>· {selectedTitle}</span>}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void doSearch();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={doSearch}
          disabled={loading || !q.trim()}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      {notConnected && (
        <div className="text-[11px] text-risk-medium mt-1">
          Conta LinkedIn não conectada via Unipile. Conecte em Configurações → Integrações.
        </div>
      )}
      {items.length > 0 && (
        <div className="mt-1 border border-border-subtle rounded-md divide-y divide-border-subtle bg-surface-2 max-h-40 overflow-auto">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                onSelect(it.id, it.title);
                setItems([]);
                setQ("");
              }}
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-surface-sunken flex items-center justify-between gap-2"
            >
              <span className="truncate">{it.title}</span>
              <span className="font-mono text-text-tertiary">{it.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
