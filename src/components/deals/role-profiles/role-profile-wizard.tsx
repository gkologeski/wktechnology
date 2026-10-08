import { useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FormSection } from "@/components/techhire/ui";
import { cn } from "@/lib/utils";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { createRoleProfile, saveRoleProfile } from "@/lib/role-profiles/role-profiles.functions";
import {
  MODALITY_LABEL,
  PRIORITY_LABEL,
  SECTION_LABEL,
  SENIORITY_LABEL,
  completeness,
  emptyData,
  marginPct,
  usesHunting,
  usesOutsourcing,
  type CommercialData,
  type ProfileData,
  type ProfileHeader,
  type SectionKey,
} from "@/lib/role-profiles/schema";

const STEPS: SectionKey[] = ["need", "role", "requirements", "conditions", "commercial", "selection"];
const NONE = "__none";

export type WizardInitial = {
  id?: string;
  revision?: number;
  header: ProfileHeader;
  data: ProfileData;
  commercial?: CommercialData | null;
  importId?: string;
  fieldStatus?: Record<string, "found" | "doubtful" | "missing">;
};

export function defaultHeader(): ProfileHeader {
  return { title: "", quantity: 1, modality: "outsourcing", priority: "medium", seniority: null, contact_id: null, assigned_to: null };
}

function Field({ label, htmlFor, hint, status, children }: { label: string; htmlFor?: string; hint?: string; status?: "found" | "doubtful" | "missing"; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-text-secondary">
          {label}
        </Label>
        {status === "doubtful" ? (
          <Badge variant="outline" className="h-5 border-warning/40 text-[10px] text-warning">Duvidoso — revise</Badge>
        ) : status === "found" ? (
          <Badge variant="outline" className="h-5 text-[10px] text-text-tertiary">Lido da fonte</Badge>
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-[11px] text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

function OptSelect<T extends string>({ id, value, onChange, options, placeholder = "Selecione" }: { id?: string; value: T | null | undefined; onChange: (v: T | undefined) => void; options: Record<T, string>; placeholder?: string }) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : (v as T))}>
      <SelectTrigger id={id} className="h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Não informado</SelectItem>
        {(Object.keys(options) as T[]).map((k) => (
          <SelectItem key={k} value={k}>
            {options[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const numOrU = (v: string) => (v === "" ? undefined : Math.max(0, Math.floor(Number(v))));

/** Chips com alternância obrigatório/desejável. */
function RequirementChips({ label, items, onChange, placeholder }: { label: string; items: { name: string; kind: "required" | "desired"; years?: number }[]; onChange: (xs: { name: string; kind: "required" | "desired"; years?: number }[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const name = draft.trim();
    if (!name || items.some((i) => i.name.toLowerCase() === name.toLowerCase())) return setDraft("");
    onChange([...items, { name, kind: "required" }]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input aria-label={label} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className="h-9" />
        <Button type="button" variant="outline" size="sm" onClick={add} className="h-9">
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden /> Adicionar
        </Button>
      </div>
      {items.length ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((it, i) => (
            <li key={it.name} className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-muted py-0.5 pl-2.5 pr-1 text-xs">
              <span className="font-medium text-text-primary">{it.name}</span>
              <button
                type="button"
                onClick={() => onChange(items.map((x, j) => (j === i ? { ...x, kind: x.kind === "required" ? "desired" : "required" } : x)))}
                className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", it.kind === "required" ? "bg-primary/10 text-primary" : "bg-muted text-text-secondary")}
                aria-label={`${it.name}: ${it.kind === "required" ? "obrigatório" : "desejável"}. Alternar`}
              >
                {it.kind === "required" ? "Obrigatório" : "Desejável"}
              </button>
              {"years" in it || label.startsWith("Tecno") ? (
                <input
                  aria-label={`Anos de experiência em ${it.name}`}
                  inputMode="numeric"
                  className="w-10 rounded bg-transparent px-1 text-[11px] text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="anos"
                  value={it.years ?? ""}
                  onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, years: numOrU(e.target.value) } : x)))}
                />
              ) : null}
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded-full p-0.5 text-text-tertiary hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Remover ${it.name}`}>
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-text-tertiary">Nenhum item. Digite e pressione Enter.</p>
      )}
    </div>
  );
}

function StringChips({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (xs: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input aria-label={label} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className="h-9" />
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={add}>Adicionar</Button>
      </div>
      <ol className="flex flex-wrap gap-2">
        {items.map((s, i) => (
          <li key={s} className="inline-flex items-center gap-1 rounded-full border border-border-subtle px-2.5 py-0.5 text-xs">
            <span className="text-text-tertiary">{i + 1}.</span> {s}
            <button type="button" onClick={() => onChange(items.filter((x) => x !== s))} aria-label={`Remover ${s}`} className="rounded-full p-0.5 text-text-tertiary hover:text-destructive">
              <X className="h-3 w-3" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RoleProfileWizard({
  open,
  onOpenChange,
  dealId,
  initial,
  canCommercial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dealId: string;
  initial: WizardInitial;
  canCommercial: boolean;
  onSaved: (id: string) => void;
}) {
  const create = useServerFn(createRoleProfile);
  const save = useServerFn(saveRoleProfile);
  const members = useWorkspaceMembers();
  const [step, setStep] = useState(0);
  const [id, setId] = useState(initial.id);
  const [revision, setRevision] = useState(initial.revision ?? 0);
  const [h, setH] = useState<ProfileHeader>(initial.header);
  const [d, setD] = useState<ProfileData>(initial.data ?? emptyData());
  const [c, setC] = useState<CommercialData>(initial.commercial ?? { outsourcing: {} });
  const [commercialTouched, setCommercialTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fs = initial.fieldStatus ?? {};

  const comp = useMemo(() => completeness({ ...h, data: d }), [h, d]);
  const patch = <K extends keyof ProfileData>(k: K, v: Partial<ProfileData[K]>) => setD((p) => ({ ...p, [k]: { ...p[k], ...v } }));
  const patchC = (v: Partial<CommercialData["outsourcing"]>) => { setCommercialTouched(true); setC((p) => ({ ...p, outsourcing: { ...p.outsourcing, ...v } })); };

  function validateStep(i: number): string[] {
    const e: string[] = [];
    if (STEPS[i] === "need") {
      if (!h.title.trim()) e.push("Informe o título do perfil.");
      if (!(h.quantity >= 1)) e.push("Quantidade deve ser maior que zero.");
    }
    if (STEPS[i] === "commercial" && usesHunting(h.modality) && d.hunting.salary_min != null && d.hunting.salary_max != null && d.hunting.salary_min > d.hunting.salary_max)
      e.push("Salário mínimo não pode ser maior que o máximo.");
    return e;
  }

  async function persist(close: boolean) {
    const e = validateStep(0);
    if (e.length) { setErrors(e); setStep(0); return; }
    setSaving(true);
    try {
      if (!id) {
        const r = await create({ data: { dealId, header: h, data: d, importId: initial.importId } });
        setId(r.id);
        // grava comercial após criar (exige permissão comercial).
        if (canCommercial && commercialTouched) {
          const s = await save({ data: { id: r.id, expectedRevision: 1, header: h, data: d, commercial: c } });
          setRevision(s.revision);
        } else setRevision(1);
        onSaved(r.id);
      } else {
        const s = await save({ data: { id, expectedRevision: revision, header: h, data: d, ...(canCommercial && commercialTouched ? { commercial: c } : {}) } });
        setRevision(s.revision);
        onSaved(id);
      }
      toast.success("Perfil salvo como rascunho. Você pode retomar a qualquer momento.");
      if (close) onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const next = () => {
    const e = validateStep(step);
    setErrors(e);
    if (!e.length) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const margin = marginPct(c);
  const cur = h.modality;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b border-product-divider px-6 py-4 text-left">
          <SheetTitle>{id ? "Editar perfil de vaga" : "Novo perfil de vaga"}</SheetTitle>
          <SheetDescription>Preencha por etapas. Salvar não aprova nem encaminha; nada é enviado ao cliente.</SheetDescription>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={comp.total * 100} className="h-1.5 flex-1" aria-label="Completude do perfil" />
            <span className="text-xs tabular-nums text-text-secondary">{Math.round(comp.total * 100)}% preenchido</span>
          </div>
          <nav aria-label="Etapas" className="mt-3 flex flex-wrap gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", i === step ? "border-primary bg-primary/10 text-primary" : "border-border-subtle text-text-secondary hover:bg-muted")}
              >
                {comp.sections[s] >= 1 ? <Check className="h-3 w-3" aria-hidden /> : <span className="tabular-nums">{i + 1}</span>}
                {SECTION_LABEL[s]}
              </button>
            ))}
          </nav>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6">
          {errors.length ? (
            <div role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {errors.map((e) => <p key={e}>{e}</p>)}
            </div>
          ) : null}

          {STEPS[step] === "need" && (
            <FormSection title="Necessidade" description="O que o cliente precisa. Quantidade = posições deste mesmo perfil.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Título do perfil *" htmlFor="rp-title" status={fs.title}>
                    <Input id="rp-title" value={h.title} maxLength={200} onChange={(e) => setH({ ...h, title: e.target.value })} placeholder="Ex.: Desenvolvedor Delphi" />
                  </Field>
                </div>
                <Field label="Quantidade de posições *" htmlFor="rp-qty" status={fs.quantity}>
                  <Input id="rp-qty" type="number" min={1} max={999} value={h.quantity} onChange={(e) => setH({ ...h, quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                </Field>
                <Field label="Modalidade *" htmlFor="rp-mod" status={fs.modality}>
                  <Select value={h.modality} onValueChange={(v) => setH({ ...h, modality: v as ProfileHeader["modality"] })}>
                    <SelectTrigger id="rp-mod" className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MODALITY_LABEL) as (keyof typeof MODALITY_LABEL)[]).map((k) => <SelectItem key={k} value={k}>{MODALITY_LABEL[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Prioridade" htmlFor="rp-pri">
                  <Select value={h.priority} onValueChange={(v) => setH({ ...h, priority: v as ProfileHeader["priority"] })}>
                    <SelectTrigger id="rp-pri" className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORITY_LABEL) as (keyof typeof PRIORITY_LABEL)[]).map((k) => <SelectItem key={k} value={k}>{PRIORITY_LABEL[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Responsável" htmlFor="rp-owner">
                  <Select value={h.assigned_to ?? NONE} onValueChange={(v) => setH({ ...h, assigned_to: v === NONE ? null : v })}>
                    <SelectTrigger id="rp-owner" className="h-9"><SelectValue placeholder="Responsável do negócio" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Responsável do negócio</SelectItem>
                      {(members.data ?? []).map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name ?? "Sem nome"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Motivo da contratação" htmlFor="rp-reason" status={fs["need.reason"]}>
                    <Textarea id="rp-reason" rows={3} value={d.need.reason ?? ""} onChange={(e) => patch("need", { reason: e.target.value })} placeholder="Expansão de equipe, substituição, novo projeto…" />
                  </Field>
                </div>
              </div>
            </FormSection>
          )}

          {STEPS[step] === "role" && (
            <FormSection title="Atuação" description="Contexto e responsabilidades que o recrutador vai usar.">
              <div className="grid gap-4">
                <Field label="Projeto / contexto" htmlFor="rp-ctx" status={fs["role.project_context"]}><Textarea id="rp-ctx" rows={3} value={d.role.project_context ?? ""} onChange={(e) => patch("role", { project_context: e.target.value })} /></Field>
                <Field label="Responsabilidades" htmlFor="rp-resp" status={fs["role.responsibilities"]}><Textarea id="rp-resp" rows={4} value={d.role.responsibilities ?? ""} onChange={(e) => patch("role", { responsibilities: e.target.value })} /></Field>
                <Field label="Entregas esperadas" htmlFor="rp-del" status={fs["role.deliverables"]}><Textarea id="rp-del" rows={3} value={d.role.deliverables ?? ""} onChange={(e) => patch("role", { deliverables: e.target.value })} /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Equipe" htmlFor="rp-team" status={fs["role.team"]}><Input id="rp-team" value={d.role.team ?? ""} onChange={(e) => patch("role", { team: e.target.value })} placeholder="Ex.: squad de 6 pessoas" /></Field>
                  <Field label="Gestor técnico" htmlFor="rp-mgr" status={fs["role.technical_manager"]}><Input id="rp-mgr" value={d.role.technical_manager ?? ""} onChange={(e) => patch("role", { technical_manager: e.target.value })} /></Field>
                </div>
              </div>
            </FormSection>
          )}

          {STEPS[step] === "requirements" && (
            <FormSection title="Requisitos" description="Clique no rótulo do item para alternar obrigatório/desejável.">
              <div className="grid gap-5">
                <Field label="Senioridade" htmlFor="rp-sen" status={fs.seniority}>
                  <OptSelect id="rp-sen" value={h.seniority ?? undefined} onChange={(v) => setH({ ...h, seniority: v ?? null })} options={SENIORITY_LABEL} />
                </Field>
                <Field label="Tecnologias e experiência" status={fs["requirements.skills"]}>
                  <RequirementChips label="Tecnologias" items={d.requirements.skills} onChange={(skills) => patch("requirements", { skills })} placeholder="Ex.: Delphi, SQL Server" />
                </Field>
                <Field label="Idiomas" status={fs["requirements.languages"]}>
                  <RequirementChips label="Idiomas" items={d.requirements.languages.map(({ name, kind }) => ({ name, kind }))} onChange={(xs) => patch("requirements", { languages: xs.map((x) => ({ name: x.name, kind: x.kind, level: d.requirements.languages.find((l) => l.name === x.name)?.level })) })} placeholder="Ex.: Inglês" />
                </Field>
                <Field label="Certificações" status={fs["requirements.certifications"]}>
                  <RequirementChips label="Certificações" items={d.requirements.certifications} onChange={(xs) => patch("requirements", { certifications: xs.map(({ name, kind }) => ({ name, kind })) })} placeholder="Ex.: AWS Solutions Architect" />
                </Field>
                <Field label="Observações de experiência" htmlFor="rp-exp"><Textarea id="rp-exp" rows={3} value={d.requirements.experience_notes ?? ""} onChange={(e) => patch("requirements", { experience_notes: e.target.value })} /></Field>
              </div>
            </FormSection>
          )}

          {STEPS[step] === "conditions" && (
            <FormSection title="Condições" description="Onde e como a pessoa vai trabalhar.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Modelo de trabalho" htmlFor="rp-wm" status={fs["conditions.work_mode"]}><OptSelect id="rp-wm" value={d.conditions.work_mode} onChange={(v) => patch("conditions", { work_mode: v })} options={{ remote: "Remoto", hybrid: "Híbrido", onsite: "Presencial" }} /></Field>
                <Field label="Localidade" htmlFor="rp-loc" hint={d.conditions.work_mode && d.conditions.work_mode !== "remote" ? "Obrigatório para híbrido/presencial." : undefined} status={fs["conditions.location"]}><Input id="rp-loc" value={d.conditions.location ?? ""} onChange={(e) => patch("conditions", { location: e.target.value })} placeholder="Cidade/UF" /></Field>
                <Field label="Jornada" htmlFor="rp-sch" status={fs["conditions.schedule"]}><Input id="rp-sch" value={d.conditions.schedule ?? ""} onChange={(e) => patch("conditions", { schedule: e.target.value })} placeholder="Ex.: 40h semanais, 9h–18h" /></Field>
                <Field label="Fuso horário" htmlFor="rp-tz"><Input id="rp-tz" value={d.conditions.timezone ?? ""} onChange={(e) => patch("conditions", { timezone: e.target.value })} placeholder="America/Sao_Paulo" /></Field>
                <Field label="Viagens" htmlFor="rp-trv"><Input id="rp-trv" value={d.conditions.travel ?? ""} onChange={(e) => patch("conditions", { travel: e.target.value })} /></Field>
                <Field label="Início desejado" htmlFor="rp-start" status={fs["conditions.start_date"]}><Input id="rp-start" type="date" value={d.conditions.start_date ?? ""} onChange={(e) => patch("conditions", { start_date: e.target.value || undefined })} /></Field>
              </div>
            </FormSection>
          )}

          {STEPS[step] === "commercial" && (
            <>
              {usesOutsourcing(cur) && (
                <FormSection title="Outsourcing" description="Condições da alocação. Ambos compartilham o perfil técnico; as condições comerciais ficam separadas.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Duração da alocação (meses)" htmlFor="rp-om" status={fs["outsourcing.allocation_months"]}><Input id="rp-om" type="number" min={1} value={d.outsourcing.allocation_months ?? ""} onChange={(e) => patch("outsourcing", { allocation_months: numOrU(e.target.value) || undefined })} /></Field>
                    <Field label="Dedicação" htmlFor="rp-od"><OptSelect id="rp-od" value={d.outsourcing.dedication} onChange={(v) => patch("outsourcing", { dedication: v })} options={{ full: "Integral", partial: "Parcial" }} /></Field>
                    <Field label="Horas por semana" htmlFor="rp-oh"><Input id="rp-oh" type="number" min={1} max={60} value={d.outsourcing.hours_per_week ?? ""} onChange={(e) => patch("outsourcing", { hours_per_week: numOrU(e.target.value) || undefined })} /></Field>
                    <Field label="Gestão" htmlFor="rp-og"><OptSelect id="rp-og" value={d.outsourcing.management} onChange={(v) => patch("outsourcing", { management: v })} options={{ client: "Cliente", provider: "WK", shared: "Compartilhada" }} /></Field>
                    <Field label="Política de início" htmlFor="rp-os"><Input id="rp-os" value={d.outsourcing.start_policy ?? ""} onChange={(e) => patch("outsourcing", { start_policy: e.target.value })} /></Field>
                    <Field label="Política de substituição" htmlFor="rp-or"><Input id="rp-or" value={d.outsourcing.replacement_policy ?? ""} onChange={(e) => patch("outsourcing", { replacement_policy: e.target.value })} /></Field>
                  </div>
                  {canCommercial ? (
                    <div className="mt-5 rounded-lg border border-warning/30 bg-warning/5 p-4">
                      <p className="mb-3 text-xs font-semibold text-text-primary">Comercial interno — restrito, nunca enviado ao cliente nem ao TechHire</p>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Preço de venda" htmlFor="rp-sp"><CurrencyInput id="rp-sp" currency={c.outsourcing.sale_currency ?? "BRL"} value={c.outsourcing.sale_price ?? null} onValueChange={(v) => patchC({ sale_price: v ?? undefined })} /></Field>
                        <Field label="Moeda" htmlFor="rp-sc"><OptSelect id="rp-sc" value={c.outsourcing.sale_currency} onChange={(v) => patchC({ sale_currency: v })} options={{ BRL: "BRL (R$)", USD: "USD (US$)", EUR: "EUR (€)" }} /></Field>
                        <Field label="Período do preço" htmlFor="rp-spp"><OptSelect id="rp-spp" value={c.outsourcing.sale_period} onChange={(v) => patchC({ sale_period: v })} options={{ hour: "Por hora", month: "Por mês" }} /></Field>
                        <Field label="Custo" htmlFor="rp-cost"><CurrencyInput id="rp-cost" currency={c.outsourcing.sale_currency ?? "BRL"} value={c.outsourcing.cost ?? null} onValueChange={(v) => patchC({ cost: v ?? undefined })} /></Field>
                        <Field label="Período do custo" htmlFor="rp-cp"><OptSelect id="rp-cp" value={c.outsourcing.cost_period} onChange={(v) => patchC({ cost_period: v })} options={{ hour: "Por hora", month: "Por mês" }} /></Field>
                        <Field label="Margem estimada" hint="Calculada só com o mesmo período em preço e custo.">
                          <p className="h-9 rounded-md border border-border-subtle px-3 py-2 text-sm tabular-nums">{margin == null ? "—" : `${margin.toFixed(1)}%`}</p>
                        </Field>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field label="Observações privadas" htmlFor="rp-in"><Textarea id="rp-in" rows={2} value={c.internal_notes ?? ""} onChange={(e) => { setCommercialTouched(true); setC({ ...c, internal_notes: e.target.value }); }} /></Field>
                        <Field label="Avaliação comercial" htmlFor="rp-ca"><Textarea id="rp-ca" rows={2} value={c.commercial_assessment ?? ""} onChange={(e) => { setCommercialTouched(true); setC({ ...c, commercial_assessment: e.target.value }); }} /></Field>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-text-tertiary">Preço, custo e margem ficam ocultos para o seu perfil de acesso.</p>
                  )}
                </FormSection>
              )}
              {usesHunting(cur) && (
                <FormSection title="Hunting" description="Contratação direta pelo cliente.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Regime de contratação" htmlFor="rp-hr" status={fs["hunting.hiring_regime"]}><OptSelect id="rp-hr" value={d.hunting.hiring_regime} onChange={(v) => patch("hunting", { hiring_regime: v })} options={{ clt: "CLT", pj: "PJ", cooperado: "Cooperado", outro: "Outro" }} /></Field>
                    <Field label="Moeda / período" htmlFor="rp-hc">
                      <div className="flex gap-2">
                        <OptSelect id="rp-hc" value={d.hunting.salary_currency} onChange={(v) => patch("hunting", { salary_currency: v })} options={{ BRL: "BRL", USD: "USD", EUR: "EUR" }} />
                        <OptSelect value={d.hunting.salary_period} onChange={(v) => patch("hunting", { salary_period: v })} options={{ month: "Mensal", year: "Anual" }} />
                      </div>
                    </Field>
                    <Field label="Salário mínimo" htmlFor="rp-smin" status={fs["hunting.salary_min"]}><CurrencyInput id="rp-smin" currency={d.hunting.salary_currency ?? "BRL"} value={d.hunting.salary_min ?? null} onValueChange={(v) => patch("hunting", { salary_min: v ?? undefined })} /></Field>
                    <Field label="Salário máximo" htmlFor="rp-smax" status={fs["hunting.salary_max"]}><CurrencyInput id="rp-smax" currency={d.hunting.salary_currency ?? "BRL"} value={d.hunting.salary_max ?? null} onValueChange={(v) => patch("hunting", { salary_max: v ?? undefined })} /></Field>
                    <div className="sm:col-span-2"><Field label="Benefícios" htmlFor="rp-ben"><Textarea id="rp-ben" rows={2} value={d.hunting.benefits ?? ""} onChange={(e) => patch("hunting", { benefits: e.target.value })} /></Field></div>
                    <Field label="Honorários — tipo" htmlFor="rp-ft"><OptSelect id="rp-ft" value={d.hunting.fee_type} onChange={(v) => patch("hunting", { fee_type: v })} options={{ percent: "% do salário anual", fixed: "Valor fixo" }} /></Field>
                    <Field label={d.hunting.fee_type === "percent" ? "Honorários (%)" : "Honorários (valor)"} htmlFor="rp-fv">
                      {d.hunting.fee_type === "percent" ? (
                        <Input id="rp-fv" type="number" min={0} max={100} step="0.5" value={d.hunting.fee_value ?? ""} onChange={(e) => patch("hunting", { fee_value: e.target.value === "" ? undefined : Number(e.target.value) })} />
                      ) : (
                        <CurrencyInput id="rp-fv" value={d.hunting.fee_value ?? null} onValueChange={(v) => patch("hunting", { fee_value: v ?? undefined })} />
                      )}
                    </Field>
                    <Field label="Condições dos honorários" htmlFor="rp-fterm"><Input id="rp-fterm" value={d.hunting.fee_terms ?? ""} onChange={(e) => patch("hunting", { fee_terms: e.target.value })} placeholder="Ex.: 50% na contratação, 50% em 30 dias" /></Field>
                    <Field label="Garantia (dias)" htmlFor="rp-g"><Input id="rp-g" type="number" min={0} max={365} value={d.hunting.guarantee_days ?? ""} onChange={(e) => patch("hunting", { guarantee_days: numOrU(e.target.value) })} /></Field>
                    <div className="sm:col-span-2"><Field label="Processo de decisão" htmlFor="rp-dec"><Textarea id="rp-dec" rows={2} value={d.hunting.decision_process ?? ""} onChange={(e) => patch("hunting", { decision_process: e.target.value })} /></Field></div>
                  </div>
                  <p className="mt-3 text-[11px] text-text-tertiary">Honorários não vão para o TechHire nem para o link do cliente.</p>
                </FormSection>
              )}
            </>
          )}

          {STEPS[step] === "selection" && (
            <FormSection title="Seleção e aprovação" description="Como o cliente vai avaliar. Anexos ficam na ficha do perfil após salvar.">
              <div className="grid gap-4">
                <Field label="Etapas de entrevista"><StringChips label="Etapas" items={d.selection.stages} onChange={(stages) => patch("selection", { stages })} placeholder="Ex.: Entrevista técnica" /></Field>
                <Field label="Avaliadores" htmlFor="rp-ev"><Input id="rp-ev" value={d.selection.evaluators ?? ""} onChange={(e) => patch("selection", { evaluators: e.target.value })} /></Field>
                <Field label="Critérios de aprovação" htmlFor="rp-crit"><Textarea id="rp-crit" rows={3} value={d.selection.criteria ?? ""} onChange={(e) => patch("selection", { criteria: e.target.value })} /></Field>
                <div className="flex items-center gap-3">
                  <Switch id="rp-cc" checked={!!d.selection.client_confirmation} onCheckedChange={(v) => patch("selection", { client_confirmation: v })} />
                  <Label htmlFor="rp-cc" className="text-sm">Exigir confirmação do cliente antes de encaminhar</Label>
                </div>
              </div>
            </FormSection>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-product-divider px-6 py-3">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Voltar
          </Button>
          <span className="text-xs text-text-tertiary">Etapa {step + 1} de {STEPS.length}</span>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" onClick={() => persist(false)} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-1 h-4 w-4" aria-hidden />} Salvar rascunho
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next}>Próximo <ChevronRight className="ml-1 h-4 w-4" aria-hidden /></Button>
            ) : (
              <Button type="button" onClick={() => persist(true)} disabled={saving}>Salvar e fechar</Button>
            )}
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
