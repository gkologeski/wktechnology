// Formulários das ações de contratação e desligamento (Fase 1).
// Todos os valores aceitam variáveis; identificadores criados por passos
// anteriores ficam disponíveis em {{vars.contratacao.person_id}} etc.
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TokenInput } from "@/components/workflows/token-input";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import type { WorkflowAction } from "@/lib/workflows/types";

type HiringAction = Extract<
  WorkflowAction,
  {
    type:
      | "create_person_from_candidate"
      | "create_contract_document"
      | "create_allocation"
      | "create_payable_schedule"
      | "create_receivable_invoice"
      | "provision_workspace_user";
  }
>;

const AREAS = ["Comercial", "Técnica", "RH", "Financeiro", "Administrativo"];

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Tok({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return <TokenInput value={value ?? ""} onValueChange={onChange} placeholder={placeholder} />;
}

function NumberInput({ value, onChange, min, max, label }: { value?: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return (
    <Input
      type="number"
      aria-label={label}
      min={min}
      max={max}
      value={value ?? ""}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.min(Math.max(Math.trunc(n), min), max));
      }}
    />
  );
}

const PERSON_HINT = "Vazio = pessoa criada no passo anterior ou vinculada ao candidato.";

export function HiringActionForm({ action, onChange }: { action: HiringAction; onChange: (a: HiringAction) => void }) {
  const set = <K extends string>(patch: Record<K, unknown>) => onChange({ ...action, ...patch } as HiringAction);

  switch (action.type) {
    case "create_person_from_candidate":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Cria a pessoa no TechPeople com os dados do candidato. Não duplica se já existir.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Área">
              <Select value={action.department || "_none"} onValueChange={(v) => set({ department: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Não definida</SelectItem>
                  {AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Vínculo">
              <Select value={action.employment_type ?? "pj"} onValueChange={(v) => set({ employment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pj">PJ</SelectItem>
                  <SelectItem value="clt">CLT</SelectItem>
                  <SelectItem value="contractor">Freelancer / por demanda</SelectItem>
                  <SelectItem value="intern">Estágio</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Cargo" hint="Vazio = título da vaga.">
            <Tok value={action.role_title} onChange={(v) => set({ role_title: v })} placeholder="Vendedor / Closer" />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Admissão"><Tok value={action.hire_date} onChange={(v) => set({ hire_date: v })} placeholder="hoje" /></Field>
            <Field label="Custo mensal"><Tok value={action.monthly_cost} onChange={(v) => set({ monthly_cost: v })} placeholder="8000" /></Field>
            <Field label="Custo/hora"><Tok value={action.cost_hour} onChange={(v) => set({ cost_hour: v })} placeholder="120" /></Field>
          </div>
        </div>
      );

    case "create_contract_document":
      return (
        <div className="space-y-3">
          <Field label="Tipo de contrato">
            <Select value={action.kind ?? "client"} onValueChange={(v) => set({ kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Compra — contratamos a PJ do profissional</SelectItem>
                <SelectItem value="provider">Prestação — prestamos serviço ao cliente</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Título" hint="Vazio = “Contrato PJ — nome do profissional”.">
            <Tok value={action.title} onChange={(v) => set({ title: v })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Início da vigência"><Tok value={action.starts_at} onChange={(v) => set({ starts_at: v })} placeholder="2026-01-01" /></Field>
            <Field label="Valor mensal"><Tok value={action.monthly_value} onChange={(v) => set({ monthly_value: v })} placeholder="8000" /></Field>
          </div>
          <Field label="Modelo de contrato">
            <EntityCombobox
              entity="contract_templates"
              select="id, name"
              searchColumns={["name"]}
              labelFrom={(r) => String((r as { name?: string }).name ?? "Modelo")}
              value={action.template_id ?? null}
              onChange={(id) => set({ template_id: id ?? undefined })}
              placeholder="Sem modelo"
              emptyLabel="Nenhum modelo"
            />
          </Field>
          <Field label="Pessoa" hint={PERSON_HINT}>
            <Tok value={action.person_id} onChange={(v) => set({ person_id: v })} />
          </Field>
          <div className="flex items-center justify-between rounded-md border p-2">
            <Label className="text-xs" htmlFor="wf-contract-doc-skip">Não recriar se a pessoa já tem contrato vigente</Label>
            <Switch id="wf-contract-doc-skip" checked={action.skip_if_exists !== false} onCheckedChange={(v) => set({ skip_if_exists: v })} />
          </div>
        </div>
      );

    case "create_allocation":
      return (
        <div className="space-y-3">
          <Field label="Projeto do cliente" hint="ID ou variável. Vazio = alocação sem projeto.">
            <Tok value={action.project_id} onChange={(v) => set({ project_id: v })} />
          </Field>
          <Field label="Papel na alocação"><Tok value={action.role_title} onChange={(v) => set({ role_title: v })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Dedicação (%)"><Tok value={action.allocation_pct} onChange={(v) => set({ allocation_pct: v })} placeholder="100" /></Field>
            <Field label="Taxa faturada/h"><Tok value={action.billable_rate} onChange={(v) => set({ billable_rate: v })} /></Field>
            <Field label="Custo/h"><Tok value={action.cost_rate} onChange={(v) => set({ cost_rate: v })} /></Field>
          </div>
          <Field label="Início"><Tok value={action.starts_at} onChange={(v) => set({ starts_at: v })} placeholder="hoje" /></Field>
          <Field label="Pessoa" hint={PERSON_HINT}><Tok value={action.person_id} onChange={(v) => set({ person_id: v })} /></Field>
        </div>
      );

    case "create_payable_schedule":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Gera parcelas mensais no Contas a Pagar, vinculadas ao contrato criado no fluxo. Não duplica ao reexecutar.
          </p>
          <Field label="Valor da parcela"><Tok value={action.amount} onChange={(v) => set({ amount: v })} placeholder="8000" /></Field>
          <Field label="Descrição"><Tok value={action.description} onChange={(v) => set({ description: v })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Parcelas"><NumberInput label="Parcelas" min={1} max={24} value={action.installments ?? 12} onChange={(n) => set({ installments: n })} /></Field>
            <Field label="Dia do vencimento"><NumberInput label="Dia do vencimento" min={1} max={28} value={action.day_of_month ?? 10} onChange={(n) => set({ day_of_month: n })} /></Field>
            <Field label="A partir de"><Tok value={action.starts_at} onChange={(v) => set({ starts_at: v })} placeholder="hoje" /></Field>
          </div>
          <Field label="Pessoa" hint={PERSON_HINT}><Tok value={action.person_id} onChange={(v) => set({ person_id: v })} /></Field>
        </div>
      );

    case "create_receivable_invoice":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Lança no Contas a Receber contra a empresa da vaga (ex.: honorários de hunting). Não cria pessoa interna.
          </p>
          <Field label="Valor"><Tok value={action.amount} onChange={(v) => set({ amount: v })} placeholder="15000" /></Field>
          <Field label="Descrição"><Tok value={action.description} onChange={(v) => set({ description: v })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Vence em (dias)"><NumberInput label="Vence em dias" min={0} max={365} value={action.due_in_days ?? 15} onChange={(n) => set({ due_in_days: n })} /></Field>
            <Field label="Empresa" hint="Vazio = empresa da vaga."><Tok value={action.company_id} onChange={(v) => set({ company_id: v })} /></Field>
          </div>
        </div>
      );

    case "provision_workspace_user":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Cria um convite pendente em Configurações › Usuários. Só funciona quando o dono do workflow é administrador; respeita o limite de usuários do plano.
          </p>
          <Field label="Email" hint="Vazio = email da pessoa contratada.">
            <Tok value={action.email} onChange={(v) => set({ email: v })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Papel">
              <Select value={action.role ?? "member"} onValueChange={(v) => set({ role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="manager">Gestor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Conjunto de permissões">
              <EntityCombobox
                entity="permission_sets"
                select="id, name"
                searchColumns={["name"]}
                labelFrom={(r) => String((r as { name?: string }).name ?? "Conjunto")}
                value={action.permission_set_id || null}
                onChange={(id) => set({ permission_set_id: id ?? "" })}
                placeholder="Selecione"
                emptyLabel="Nenhum conjunto"
              />
            </Field>
          </div>
        </div>
      );
  }
}
