// Campos do perfil de vaga, por seção. Usado pelo editor de vários perfis.
// Sem comercial interno (preço, custo, margem, honorários): isso fica nos itens de linha.
import { useState, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection } from "@/components/techhire/ui";
import { cn } from "@/lib/utils";
import {
  MODALITY_LABEL,
  PRIORITY_LABEL,
  SENIORITY_LABEL,
  BENEFIT_PRESETS,
  EDUCATION_LABEL,
  METHODOLOGY_PRESETS,
  SOFT_SKILL_PRESETS,
  usesHunting,
  usesOutsourcing,
  type ProfileData,
  type ProfileHeader,
  type SectionKey,
} from "@/lib/role-profiles/schema";

const NONE = "__none";
export type FieldStatus = Record<string, "found" | "doubtful" | "missing">;

export function defaultHeader(): ProfileHeader {
  return {
    title: "",
    quantity: 1,
    modality: "outsourcing",
    priority: "medium",
    seniority: null,
    contact_id: null,
    assigned_to: null,
  };
}

function Field({
  label,
  htmlFor,
  hint,
  status,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  status?: "found" | "doubtful" | "missing";
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-text-secondary">
          {label}
        </Label>
        {status === "doubtful" ? (
          <Badge variant="outline" className="h-5 border-warning/40 text-[10px] text-warning">
            Duvidoso — revise
          </Badge>
        ) : status === "found" ? (
          <Badge variant="outline" className="h-5 text-[10px] text-text-tertiary">
            Lido da fonte
          </Badge>
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-[11px] text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

function OptSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  placeholder = "Selecione",
}: {
  id?: string;
  value: T | null | undefined;
  onChange: (v: T | undefined) => void;
  options: Record<T, string>;
  placeholder?: string;
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? undefined : (v as T))}
    >
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
function PresetToggles({
  label,
  presets,
  selected,
  onToggle,
}: {
  label: string;
  presets: string[];
  selected: string[];
  onToggle: (name: string) => void;
}) {
  return (
    <div role="group" aria-label={`Atalhos: ${label}`} className="flex flex-wrap gap-1.5">
      {presets.map((p) => {
        const on = selected.some((x) => x.toLowerCase() === p.toLowerCase());
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(p)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on
                ? "border-primary bg-primary/10 text-primary"
                : "border-border-subtle bg-background text-text-secondary hover:bg-muted",
            )}
          >
            {on ? <Check className="mr-1 inline h-3 w-3" aria-hidden /> : null}
            {p}
          </button>
        );
      })}
    </div>
  );
}

function PresetStringChips({
  label,
  presets,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  presets: string[];
  items: string[];
  onChange: (xs: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const has = (n: string) => items.some((x) => x.toLowerCase() === n.toLowerCase());
  const toggle = (n: string) =>
    onChange(has(n) ? items.filter((x) => x.toLowerCase() !== n.toLowerCase()) : [...items, n]);
  const add = () => {
    const n = draft.trim();
    if (n && !has(n)) onChange([...items, n]);
    setDraft("");
  };
  const custom = items.filter((x) => !presets.some((p) => p.toLowerCase() === x.toLowerCase()));
  return (
    <div className="space-y-2">
      <PresetToggles label={label} presets={presets} selected={items} onToggle={toggle} />
      <div className="flex gap-2">
        <Input
          aria-label={`Outro: ${label}`}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-9"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} className="h-9">
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden /> Adicionar
        </Button>
      </div>
      {custom.length ? (
        <ul className="flex flex-wrap gap-2">
          {custom.map((c) => (
            <li
              key={c}
              className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-muted py-0.5 pl-2.5 pr-1 text-xs"
            >
              <span className="font-medium text-text-primary">{c}</span>
              <button
                type="button"
                onClick={() => toggle(c)}
                aria-label={`Remover ${c}`}
                className="rounded-full p-0.5 text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RequirementChips({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: { name: string; kind: "required" | "desired"; years?: number }[];
  onChange: (xs: { name: string; kind: "required" | "desired"; years?: number }[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const name = draft.trim();
    if (!name || items.some((i) => i.name.toLowerCase() === name.toLowerCase()))
      return setDraft("");
    onChange([...items, { name, kind: "required" }]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          aria-label={label}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-9"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} className="h-9">
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden /> Adicionar
        </Button>
      </div>
      {items.length ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((it, i) => (
            <li
              key={it.name}
              className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-muted py-0.5 pl-2.5 pr-1 text-xs"
            >
              <span className="font-medium text-text-primary">{it.name}</span>
              <button
                type="button"
                onClick={() =>
                  onChange(
                    items.map((x, j) =>
                      j === i ? { ...x, kind: x.kind === "required" ? "desired" : "required" } : x,
                    ),
                  )
                }
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  it.kind === "required"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-text-secondary",
                )}
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
                  onChange={(e) =>
                    onChange(
                      items.map((x, j) => (j === i ? { ...x, years: numOrU(e.target.value) } : x)),
                    )
                  }
                />
              ) : null}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="rounded-full p-0.5 text-text-tertiary hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remover ${it.name}`}
              >
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

function StringChips({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (xs: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          aria-label={label}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-9"
        />
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={add}>
          Adicionar
        </Button>
      </div>
      <ol className="flex flex-wrap gap-2">
        {items.map((s, i) => (
          <li
            key={s}
            className="inline-flex items-center gap-1 rounded-full border border-border-subtle px-2.5 py-0.5 text-xs"
          >
            <span className="text-text-tertiary">{i + 1}.</span> {s}
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x !== s))}
              aria-label={`Remover ${s}`}
              className="rounded-full p-0.5 text-text-tertiary hover:text-destructive"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProfileSection({
  section,
  idPrefix: p,
  h,
  setH,
  d,
  setD,
  fs = {},
  members,
  titleSlot,
}: {
  section: SectionKey;
  idPrefix: string;
  h: ProfileHeader;
  setH: (h: ProfileHeader) => void;
  d: ProfileData;
  setD: (d: ProfileData) => void;
  fs?: FieldStatus;
  members: { user_id: string; full_name: string | null }[];
  titleSlot: ReactNode;
}) {
  const patch = <K extends keyof ProfileData>(k: K, v: Partial<ProfileData[K]>) =>
    setD({ ...d, [k]: { ...d[k], ...v } });
  const cur = h.modality;
  return (
    <>
          {section === "need" && (
            <FormSection
              title="Necessidade"
              description="O que o cliente precisa. Quantidade = posições deste mesmo perfil."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Cargo / preset (título) *" htmlFor={`${p}-title`} status={fs.title}>
                    {titleSlot}
                  </Field>
                </div>
                <Field label="Quantidade de posições *" htmlFor={`${p}-qty`} status={fs.quantity}>
                  <Input
                    id={`${p}-qty`}
                    type="number"
                    min={1}
                    max={999}
                    value={h.quantity}
                    onChange={(e) =>
                      setH({ ...h, quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                    }
                  />
                </Field>
                <Field label="Modalidade *" htmlFor={`${p}-mod`} status={fs.modality}>
                  <Select
                    value={h.modality}
                    onValueChange={(v) => setH({ ...h, modality: v as ProfileHeader["modality"] })}
                  >
                    <SelectTrigger id={`${p}-mod`} className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MODALITY_LABEL) as (keyof typeof MODALITY_LABEL)[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {MODALITY_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Prioridade" htmlFor={`${p}-pri`}>
                  <Select
                    value={h.priority}
                    onValueChange={(v) => setH({ ...h, priority: v as ProfileHeader["priority"] })}
                  >
                    <SelectTrigger id={`${p}-pri`} className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORITY_LABEL) as (keyof typeof PRIORITY_LABEL)[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {PRIORITY_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Responsável" htmlFor={`${p}-owner`}>
                  <Select
                    value={h.assigned_to ?? NONE}
                    onValueChange={(v) => setH({ ...h, assigned_to: v === NONE ? null : v })}
                  >
                    <SelectTrigger id={`${p}-owner`} className="h-9">
                      <SelectValue placeholder="Responsável do negócio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Responsável do negócio</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name ?? "Sem nome"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field
                    label="Motivo da contratação"
                    htmlFor={`${p}-reason`}
                    status={fs["need.reason"]}
                  >
                    <Textarea
                      id={`${p}-reason`}
                      rows={3}
                      value={d.need.reason ?? ""}
                      onChange={(e) => patch("need", { reason: e.target.value })}
                      placeholder="Expansão de equipe, substituição, novo projeto…"
                    />
                  </Field>
                </div>
              </div>
            </FormSection>
          )}

          {section === "role" && (
            <FormSection
              title="Atuação"
              description="Contexto e responsabilidades que o recrutador vai usar."
            >
              <div className="grid gap-4">
                <Field
                  label="Projeto / contexto"
                  htmlFor={`${p}-ctx`}
                  status={fs["role.project_context"]}
                >
                  <Textarea
                    id={`${p}-ctx`}
                    rows={3}
                    value={d.role.project_context ?? ""}
                    onChange={(e) => patch("role", { project_context: e.target.value })}
                  />
                </Field>
                <Field
                  label="Responsabilidades"
                  htmlFor={`${p}-resp`}
                  status={fs["role.responsibilities"]}
                >
                  <Textarea
                    id={`${p}-resp`}
                    rows={4}
                    value={d.role.responsibilities ?? ""}
                    onChange={(e) => patch("role", { responsibilities: e.target.value })}
                  />
                </Field>
                <Field label="Entregas esperadas" htmlFor={`${p}-del`} status={fs["role.deliverables"]}>
                  <Textarea
                    id={`${p}-del`}
                    rows={3}
                    value={d.role.deliverables ?? ""}
                    onChange={(e) => patch("role", { deliverables: e.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Equipe" htmlFor={`${p}-team`} status={fs["role.team"]}>
                    <Input
                      id={`${p}-team`}
                      value={d.role.team ?? ""}
                      onChange={(e) => patch("role", { team: e.target.value })}
                      placeholder="Ex.: squad de 6 pessoas"
                    />
                  </Field>
                  <Field
                    label="Gestor técnico"
                    htmlFor={`${p}-mgr`}
                    status={fs["role.technical_manager"]}
                  >
                    <Input
                      id={`${p}-mgr`}
                      value={d.role.technical_manager ?? ""}
                      onChange={(e) => patch("role", { technical_manager: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Metodologias de trabalho" status={fs["role.methodologies"]}>
                  <PresetStringChips
                    label="Metodologias"
                    presets={METHODOLOGY_PRESETS}
                    items={d.role.methodologies ?? []}
                    onChange={(methodologies) => patch("role", { methodologies })}
                    placeholder="Outra metodologia"
                  />
                </Field>
              </div>
            </FormSection>
          )}

          {section === "requirements" && (
            <FormSection
              title="Requisitos"
              description="Clique no rótulo do item para alternar obrigatório/desejável."
            >
              <div className="grid gap-5">
                <Field label="Senioridade" htmlFor={`${p}-sen`} status={fs.seniority}>
                  <OptSelect
                    id={`${p}-sen`}
                    value={h.seniority ?? undefined}
                    onChange={(v) => setH({ ...h, seniority: v ?? null })}
                    options={SENIORITY_LABEL}
                  />
                </Field>
                <Field label="Tecnologias e experiência" status={fs["requirements.skills"]}>
                  <RequirementChips
                    label="Tecnologias"
                    items={d.requirements.skills}
                    onChange={(skills) => patch("requirements", { skills })}
                    placeholder="Ex.: Delphi, SQL Server"
                  />
                </Field>
                <Field label="Idiomas" status={fs["requirements.languages"]}>
                  <RequirementChips
                    label="Idiomas"
                    items={d.requirements.languages.map(({ name, kind }) => ({ name, kind }))}
                    onChange={(xs) =>
                      patch("requirements", {
                        languages: xs.map((x) => ({
                          name: x.name,
                          kind: x.kind,
                          level: d.requirements.languages.find((l) => l.name === x.name)?.level,
                        })),
                      })
                    }
                    placeholder="Ex.: Inglês"
                  />
                </Field>
                <Field label="Certificações" status={fs["requirements.certifications"]}>
                  <RequirementChips
                    label="Certificações"
                    items={d.requirements.certifications}
                    onChange={(xs) =>
                      patch("requirements", {
                        certifications: xs.map(({ name, kind }) => ({ name, kind })),
                      })
                    }
                    placeholder="Ex.: AWS Solutions Architect"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Nível de escolaridade"
                    htmlFor={`${p}-edu`}
                    status={fs["requirements.education"]}
                  >
                    <OptSelect
                      id={`${p}-edu`}
                      value={d.requirements.education?.level}
                      onChange={(level) =>
                        patch("requirements", {
                          education: { ...d.requirements.education, level },
                        })
                      }
                      options={EDUCATION_LABEL}
                    />
                  </Field>
                  <Field label="Exigência" htmlFor={`${p}-edu-kind`}>
                    <OptSelect
                      id={`${p}-edu-kind`}
                      value={d.requirements.education?.kind}
                      onChange={(kind) =>
                        patch("requirements", {
                          education: { ...d.requirements.education, kind },
                        })
                      }
                      options={{ required: "Obrigatório", desired: "Desejável" }}
                    />
                  </Field>
                  <Field label="Área de formação" htmlFor={`${p}-edu-field`}>
                    <Input
                      id={`${p}-edu-field`}
                      value={d.requirements.education?.field ?? ""}
                      placeholder="Ex.: Ciência da Computação"
                      onChange={(e) =>
                        patch("requirements", {
                          education: { ...d.requirements.education, field: e.target.value },
                        })
                      }
                    />
                  </Field>
                </div>
                <Field label="Competências comportamentais" status={fs["requirements.soft_skills"]}>
                  <div className="space-y-2">
                    <PresetToggles
                      label="Competências comportamentais"
                      presets={SOFT_SKILL_PRESETS}
                      selected={(d.requirements.soft_skills ?? []).map((x) => x.name)}
                      onToggle={(n) => {
                        const cur = d.requirements.soft_skills ?? [];
                        const on = cur.some((x) => x.name.toLowerCase() === n.toLowerCase());
                        patch("requirements", {
                          soft_skills: on
                            ? cur.filter((x) => x.name.toLowerCase() !== n.toLowerCase())
                            : [...cur, { name: n, kind: "required" }],
                        });
                      }}
                    />
                    <RequirementChips
                      label="Competências comportamentais"
                      items={d.requirements.soft_skills ?? []}
                      onChange={(xs) =>
                        patch("requirements", {
                          soft_skills: xs.map(({ name, kind }) => ({ name, kind })),
                        })
                      }
                      placeholder="Outra competência"
                    />
                  </div>
                </Field>
                <Field label="Observações de experiência" htmlFor={`${p}-exp`}>
                  <Textarea
                    id={`${p}-exp`}
                    rows={3}
                    value={d.requirements.experience_notes ?? ""}
                    onChange={(e) => patch("requirements", { experience_notes: e.target.value })}
                  />
                </Field>
              </div>
            </FormSection>
          )}

          {section === "conditions" && (
            <FormSection title="Condições" description="Onde e como a pessoa vai trabalhar.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Modelo de trabalho"
                  htmlFor={`${p}-wm`}
                  status={fs["conditions.work_mode"]}
                >
                  <OptSelect
                    id={`${p}-wm`}
                    value={d.conditions.work_mode}
                    onChange={(v) => patch("conditions", { work_mode: v })}
                    options={{ remote: "Remoto", hybrid: "Híbrido", onsite: "Presencial" }}
                  />
                </Field>
                <Field
                  label="Localidade"
                  htmlFor={`${p}-loc`}
                  hint={
                    d.conditions.work_mode && d.conditions.work_mode !== "remote"
                      ? "Obrigatório para híbrido/presencial."
                      : undefined
                  }
                  status={fs["conditions.location"]}
                >
                  <Input
                    id={`${p}-loc`}
                    value={d.conditions.location ?? ""}
                    onChange={(e) => patch("conditions", { location: e.target.value })}
                    placeholder="Cidade/UF"
                  />
                </Field>
                <Field label="Jornada" htmlFor={`${p}-sch`} status={fs["conditions.schedule"]}>
                  <Input
                    id={`${p}-sch`}
                    value={d.conditions.schedule ?? ""}
                    onChange={(e) => patch("conditions", { schedule: e.target.value })}
                    placeholder="Ex.: 40h semanais, 9h–18h"
                  />
                </Field>
                <Field label="Fuso horário" htmlFor={`${p}-tz`}>
                  <Input
                    id={`${p}-tz`}
                    value={d.conditions.timezone ?? ""}
                    onChange={(e) => patch("conditions", { timezone: e.target.value })}
                    placeholder="America/Sao_Paulo"
                  />
                </Field>
                <Field label="Viagens" htmlFor={`${p}-trv`}>
                  <Input
                    id={`${p}-trv`}
                    value={d.conditions.travel ?? ""}
                    onChange={(e) => patch("conditions", { travel: e.target.value })}
                  />
                </Field>
                <Field
                  label="Início desejado"
                  htmlFor={`${p}-start`}
                  status={fs["conditions.start_date"]}
                >
                  <Input
                    id={`${p}-start`}
                    type="date"
                    value={d.conditions.start_date ?? ""}
                    onChange={(e) =>
                      patch("conditions", { start_date: e.target.value || undefined })
                    }
                  />
                </Field>
              </div>
            </FormSection>
          )}

          {section === "commercial" && (
            <>
              {usesOutsourcing(cur) && (
                <FormSection
                  title="Outsourcing"
                  description="Condições da alocação para o profissional."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Duração da alocação (meses)"
                      htmlFor={`${p}-om`}
                      status={fs["outsourcing.allocation_months"]}
                    >
                      <Input
                        id={`${p}-om`}
                        type="number"
                        min={1}
                        value={d.outsourcing.allocation_months ?? ""}
                        onChange={(e) =>
                          patch("outsourcing", {
                            allocation_months: numOrU(e.target.value) || undefined,
                          })
                        }
                      />
                    </Field>
                    <Field label="Dedicação" htmlFor={`${p}-od`}>
                      <OptSelect
                        id={`${p}-od`}
                        value={d.outsourcing.dedication}
                        onChange={(v) => patch("outsourcing", { dedication: v })}
                        options={{ full: "Integral", partial: "Parcial" }}
                      />
                    </Field>
                    <Field label="Horas por semana" htmlFor={`${p}-oh`}>
                      <Input
                        id={`${p}-oh`}
                        type="number"
                        min={1}
                        max={60}
                        value={d.outsourcing.hours_per_week ?? ""}
                        onChange={(e) =>
                          patch("outsourcing", {
                            hours_per_week: numOrU(e.target.value) || undefined,
                          })
                        }
                      />
                    </Field>
                    <Field label="Gestão" htmlFor={`${p}-og`}>
                      <OptSelect
                        id={`${p}-og`}
                        value={d.outsourcing.management}
                        onChange={(v) => patch("outsourcing", { management: v })}
                        options={{ client: "Cliente", provider: "WK", shared: "Compartilhada" }}
                      />
                    </Field>
                    <Field label="Política de início" htmlFor={`${p}-os`}>
                      <Input
                        id={`${p}-os`}
                        value={d.outsourcing.start_policy ?? ""}
                        onChange={(e) => patch("outsourcing", { start_policy: e.target.value })}
                      />
                    </Field>
                    <Field label="Política de substituição" htmlFor={`${p}-or`}>
                      <Input
                        id={`${p}-or`}
                        value={d.outsourcing.replacement_policy ?? ""}
                        onChange={(e) =>
                          patch("outsourcing", { replacement_policy: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </FormSection>
              )}
              {usesHunting(cur) && (
                <FormSection title="Hunting" description="Contratação direta pelo cliente: regime, remuneração e benefícios do candidato.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Regime de contratação"
                      htmlFor={`${p}-hr`}
                      status={fs["hunting.hiring_regime"]}
                    >
                      <OptSelect
                        id={`${p}-hr`}
                        value={d.hunting.hiring_regime}
                        onChange={(v) => patch("hunting", { hiring_regime: v })}
                        options={{ clt: "CLT", pj: "PJ", cooperado: "Cooperado", outro: "Outro" }}
                      />
                    </Field>
                    <Field label="Moeda / período" htmlFor={`${p}-hc`}>
                      <div className="flex gap-2">
                        <OptSelect
                          id={`${p}-hc`}
                          value={d.hunting.salary_currency}
                          onChange={(v) => patch("hunting", { salary_currency: v })}
                          options={{ BRL: "BRL", USD: "USD", EUR: "EUR" }}
                        />
                        <OptSelect
                          value={d.hunting.salary_period}
                          onChange={(v) => patch("hunting", { salary_period: v })}
                          options={{ month: "Mensal", year: "Anual" }}
                        />
                      </div>
                    </Field>
                    <Field
                      label="Salário mínimo"
                      htmlFor={`${p}-smin`}
                      status={fs["hunting.salary_min"]}
                    >
                      <CurrencyInput
                        id={`${p}-smin`}
                        currency={d.hunting.salary_currency ?? "BRL"}
                        value={d.hunting.salary_min ?? null}
                        onValueChange={(v) => patch("hunting", { salary_min: v ?? undefined })}
                      />
                    </Field>
                    <Field
                      label="Salário máximo"
                      htmlFor={`${p}-smax`}
                      status={fs["hunting.salary_max"]}
                    >
                      <CurrencyInput
                        id={`${p}-smax`}
                        currency={d.hunting.salary_currency ?? "BRL"}
                        value={d.hunting.salary_max ?? null}
                        onValueChange={(v) => patch("hunting", { salary_max: v ?? undefined })}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Benefícios" htmlFor={`${p}-ben`}>
                        <div className="mb-2">
                          <PresetStringChips
                            label="Benefícios"
                            presets={BENEFIT_PRESETS}
                            items={d.hunting.benefit_options ?? []}
                            onChange={(benefit_options) => patch("hunting", { benefit_options })}
                            placeholder="Outro benefício"
                          />
                        </div>
                        <Textarea
                          placeholder="Detalhes (valores, regras)"
                          id={`${p}-ben`}
                          rows={2}
                          value={d.hunting.benefits ?? ""}
                          onChange={(e) => patch("hunting", { benefits: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Processo de decisão" htmlFor={`${p}-dec`}>
                        <Textarea
                          id={`${p}-dec`}
                          rows={2}
                          value={d.hunting.decision_process ?? ""}
                          onChange={(e) => patch("hunting", { decision_process: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                </FormSection>
              )}
            </>
          )}

          {section === "selection" && (
            <FormSection
              title="Seleção e aprovação"
              description="Como o cliente vai avaliar. Anexos ficam na ficha do perfil após salvar."
            >
              <div className="grid gap-4">
                <Field label="Etapas de entrevista">
                  <StringChips
                    label="Etapas"
                    items={d.selection.stages}
                    onChange={(stages) => patch("selection", { stages })}
                    placeholder="Ex.: Entrevista técnica"
                  />
                </Field>
                <Field label="Avaliadores" htmlFor={`${p}-ev`}>
                  <Input
                    id={`${p}-ev`}
                    value={d.selection.evaluators ?? ""}
                    onChange={(e) => patch("selection", { evaluators: e.target.value })}
                  />
                </Field>
                <Field label="Critérios de aprovação" htmlFor={`${p}-crit`}>
                  <Textarea
                    id={`${p}-crit`}
                    rows={3}
                    value={d.selection.criteria ?? ""}
                    onChange={(e) => patch("selection", { criteria: e.target.value })}
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <Switch
                    id={`${p}-cc`}
                    checked={!!d.selection.client_confirmation}
                    onCheckedChange={(v) => patch("selection", { client_confirmation: v })}
                  />
                  <Label htmlFor={`${p}-cc`} className="text-sm">
                    Exigir confirmação do cliente antes de encaminhar
                  </Label>
                </div>
              </div>
            </FormSection>
          )}
    </>
  );
}

export type WizardInitial = {
  id?: string;
  revision?: number;
  header: ProfileHeader;
  data: ProfileData;
  commercial?: unknown;
  importId?: string;
  fieldStatus?: FieldStatus;
};
