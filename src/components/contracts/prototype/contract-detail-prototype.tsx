import { useState } from "react";
import { Check, ChevronDown, Circle, MoreHorizontal, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, SectionHeader } from "@/components/techhire/ui";
import { cn } from "@/lib/utils";
import {
  PROTO_CONTRACT,
  PROTO_SCENARIOS,
  PROTO_STAGES,
  type ProtoStage,
} from "./data";

const ORDER: ProtoStage[] = ["draft", "in_review", "awaiting_signature", "active"];

function StageStepper({ current }: { current: ProtoStage }) {
  const idx = ORDER.indexOf(current);
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Etapas do contrato">
      {PROTO_STAGES.map((s, i) => {
        const done = i < idx;
        const now = i === idx;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              aria-current={now ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                now && "border-primary bg-primary/10 text-primary",
                done && "border-border bg-muted text-foreground",
                !now && !done && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
              {s.label}
            </span>
            {i < PROTO_STAGES.length - 1 && (
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function NextStepCard({ stage }: { stage: ProtoStage }) {
  const s = PROTO_SCENARIOS[stage];
  const blocked = s.checklist?.some((c) => !c.done);
  return (
    <section
      aria-labelledby="next-step-title"
      className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Próximo passo</p>
          <h2 id="next-step-title" className="text-lg font-semibold text-foreground mt-1">
            {s.headline}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{s.explanation}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {s.secondary?.map((a) => (
            <Button key={a} variant="outline" size="sm">
              {a}
            </Button>
          ))}
          <Button size="sm" disabled={blocked} title={blocked ? "Conclua os itens pendentes" : undefined}>
            {s.primary}
          </Button>
        </div>
      </div>
      {s.checklist && (
        <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">
          {s.checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              {c.done ? (
                <Check className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
              )}
              <span className={c.done ? "text-foreground" : "text-destructive"}>
                {c.label}
                <span className="sr-only">{c.done ? " — concluído" : " — pendente"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {s.people && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
          {s.people.map((p) => (
            <li key={p.name} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground"> · {p.role}</span>
              </span>
              <Badge variant={p.state === "Pendente" ? "outline" : "secondary"}>{p.state}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}

export function ContractDetailPrototype() {
  const [stage, setStage] = useState<ProtoStage>("draft");
  const s = PROTO_SCENARIOS[stage];
  const c = PROTO_CONTRACT;
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl">
      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm flex flex-wrap items-center gap-2">
        <span className="font-medium">Protótipo (dados de exemplo).</span>
        <span className="text-muted-foreground">Ver situação:</span>
        {ORDER.map((st) => (
          <Button
            key={st}
            size="sm"
            variant={st === stage ? "default" : "outline"}
            onClick={() => setStage(st)}
            aria-pressed={st === stage}
          >
            {PROTO_SCENARIOS[st].statusLabel}
          </Button>
        ))}
      </div>

      <PageHeader
        eyebrow={`TechContracts · ${c.number}`}
        title={c.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{s.statusLabel}</Badge>
            {c.counterparty} · {c.value} · {c.starts} a {c.ends}
          </span>
        }
        secondaryActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4 mr-1" aria-hidden /> Mais ações
                <ChevronDown className="h-3.5 w-3.5 ml-1" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Fluxo do contrato</DropdownMenuItem>
              <DropdownMenuItem>Medições</DropdownMenuItem>
              <DropdownMenuItem>Visualizar arquivo original</DropdownMenuItem>
              <DropdownMenuItem>Duplicar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Excluir…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        primaryAction={<Button size="sm" variant="outline">Salvar alterações</Button>}
      />

      <StageStepper current={stage} />
      <NextStepCard stage={stage} />

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="document">Documento</TabsTrigger>
          <TabsTrigger value="approvals">Aprovações e assinatura</TabsTrigger>
          <TabsTrigger value="amendments">Aditivos e vínculos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="grid gap-5 md:grid-cols-2 pt-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionHeader title="Dados principais" />
            <dl className="mt-2">
              <Field label="Tipo" value="Prestação" />
              <Field label="Documento" value="Principal" />
              <Field label="Valor total" value={c.value} />
              <Field label="Pagamento" value={c.payment} />
            </dl>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionHeader title="Vigência" />
            <dl className="mt-2">
              <Field label="Início" value={c.starts} />
              <Field label="Fim" value={c.ends} />
              <Field label="Renovação automática" value="Não" />
              <Field label="Origem" value="Proposta aceita — versão 1" />
            </dl>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 md:col-span-2">
            <SectionHeader title="Serviços" description="Ativados junto com o contrato." />
            <p className="text-sm text-muted-foreground mt-2">Consultoria — pacote de 300 horas.</p>
          </div>
        </TabsContent>
        {(["document", "approvals", "amendments", "history"] as const).map((t) => (
          <TabsContent key={t} value={t} className="pt-3">
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aqui entram os cartões atuais desta área, sem remover nenhuma função.
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
