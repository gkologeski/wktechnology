// Política de entrega de negócios do workspace (somente administrador ativo).
// Ativar marca o início: só ganhos a partir desse momento entram na fila; nada antigo é reprocessado.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormSection,
  MetricCard,
  PageHeader,
  Skeletons,
  StatusBadge,
} from "@/components/techhire/ui";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { getDeliveryPolicy, saveDeliveryPolicy } from "@/lib/projects/deal-delivery.functions";
import { formatDateTime } from "@/lib/crm";

type Origins = { user: boolean; system: boolean; workflow: boolean; import: boolean };
const NONE = "__none__";
const ORIGIN_ROWS: Array<{ key: keyof Origins; label: string; hint: string }> = [
  { key: "user", label: "Pela tela", hint: "Alguém move o negócio para uma etapa do tipo ganho." },
  {
    key: "system",
    label: "Por API e integrações",
    hint: "API pública, automações externas e gravações do sistema.",
  },
  {
    key: "workflow",
    label: "Pela ação de workflow",
    hint: "Passo “Criar ou vincular projeto de entrega”.",
  },
  {
    key: "import",
    label: "Por importação",
    hint: "Sincronização/replay de importações (ex.: HubSpot). Desligado evita criar projetos em massa.",
  },
];

export function DeliveryPolicyPage() {
  const qc = useQueryClient();
  const get = useServerFn(getDeliveryPolicy);
  const save = useServerFn(saveDeliveryPolicy);
  const members = useWorkspaceMembers();
  const q = useQuery({
    queryKey: ["delivery-policy"],
    queryFn: () => get(),
    refetchInterval: 60_000,
  });
  const [enabled, setEnabled] = useState(false);
  const [allowGroups, setAllowGroups] = useState(true);
  const [origins, setOrigins] = useState<Origins>({
    user: true,
    system: true,
    workflow: true,
    import: false,
  });
  const [creator, setCreator] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [reset, setReset] = useState(false);

  useEffect(() => {
    const p = q.data?.policy;
    if (!q.data) return;
    setEnabled(p?.enabled ?? false);
    setAllowGroups(p?.allow_groups ?? true);
    setOrigins(p?.origins ?? { user: true, system: true, workflow: true, import: false });
    setCreator(p?.project_creator_id ?? null);
    setOwner(p?.default_operational_owner_id ?? null);
    setReset(false);
  }, [q.data]);

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          enabled,
          allowGroups,
          origins,
          creatorId: creator,
          defaultOwnerId: owner,
          resetActivation: reset,
        },
      }),
    onSuccess: () => {
      toast.success("Política de entrega salva.");
      void qc.invalidateQueries({ queryKey: ["delivery-policy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastRun = q.data?.worker.last_run_at ? new Date(q.data.worker.last_run_at) : null;
  const workerStale = !lastRun || Date.now() - lastRun.getTime() > 10 * 60_000;
  const jobs = q.data?.jobs ?? {};
  const memberOptions = members.data ?? [];

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="TechProjects · Configurações"
        title="Entrega de negócios"
        description="Quando um negócio é ganho, o TechProjects cria ou reconhece o projeto de entrega em planejamento. Sem contrato obrigatório, sem ativar equipe, cobrança ou contas."
      />
      {q.isLoading ? (
        <Skeletons.Card />
      ) : q.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a política. Esta tela é só para administradores ativos do
            workspace.
          </p>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Na fila" value={String((jobs.pending ?? 0) + (jobs.running ?? 0))} />
            <MetricCard
              label="Com falha"
              value={String(jobs.failed ?? 0)}
              tone={(jobs.failed ?? 0) > 0 ? "negative" : undefined}
            />
            <MetricCard
              label="Projetos criados automaticamente"
              value={String(q.data?.projects.auto ?? 0)}
            />
            <MetricCard label="Revisões abertas" value={String(q.data?.reviews_open ?? 0)} />
          </div>

          <FormSection
            title="Criação automática"
            description="Vale para todos os funis: o sistema reconhece o tipo “ganho” da etapa, inclusive etapas personalizadas."
          >
            <div className="space-y-4">
              <label className="flex items-start gap-3">
                <Switch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  aria-label="Ativar criação automática"
                />
                <span className="text-sm">
                  <span className="font-medium">
                    Criar ou vincular o projeto quando o negócio for ganho
                  </span>
                  <span className="block text-muted-foreground">
                    {q.data?.policy?.activated_at
                      ? `Marco de ativação: ${formatDateTime(q.data.policy.activated_at)}. Ganhos anteriores não são reprocessados; use a conciliação do histórico.`
                      : "Ao ativar, o marco é o momento do salvamento. Ganhos anteriores não são reprocessados."}
                  </span>
                </span>
              </label>
              {enabled && q.data?.policy?.activated_at && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={reset} onCheckedChange={(v) => setReset(v === true)} />
                  Reiniciar o marco de ativação agora
                </label>
              )}
              <label className="flex items-start gap-3">
                <Switch
                  checked={allowGroups}
                  onCheckedChange={setAllowGroups}
                  aria-label="Permitir vários projetos por entrega"
                />
                <span className="text-sm">
                  <span className="font-medium">Permitir vários projetos por entrega</span>
                  <span className="block text-muted-foreground">
                    Padrão: 1 projeto por negócio. Com grupos definidos no negócio, 1 projeto por
                    grupo; a quantidade do item nunca multiplica projetos.
                  </span>
                </span>
              </label>
            </div>
          </FormSection>

          <FormSection
            title="Origem do ganho"
            description="Escolha de onde o ganho pode disparar a preparação. Ganhos ignorados ficam registrados como “não aplicada”."
          >
            <div className="space-y-3">
              {ORIGIN_ROWS.map((o) => (
                <label key={o.key} className="flex items-start gap-3">
                  <Switch
                    checked={origins[o.key]}
                    onCheckedChange={(v) => setOrigins((prev) => ({ ...prev, [o.key]: v }))}
                    aria-label={o.label}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{o.label}</span>
                    <span className="block text-muted-foreground">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </FormSection>

          <FormSection
            title="Pessoas"
            description="Nenhuma permissão, papel ou membership é concedido por estas escolhas."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dd-creator">Criador dos projetos automáticos (obrigatório)</Label>
                <Select
                  value={creator ?? NONE}
                  onValueChange={(v) => setCreator(v === NONE ? null : v)}
                >
                  <SelectTrigger id="dd-creator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Escolha</SelectItem>
                    {memberOptions.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name ?? members.nameFor(u.user_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Fica como dono técnico do registro. O vendedor nunca é usado como gestor.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dd-owner">Responsável operacional padrão (opcional)</Label>
                <Select
                  value={owner ?? NONE}
                  onValueChange={(v) => setOwner(v === NONE ? null : v)}
                >
                  <SelectTrigger id="dd-owner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhum (fica pendente em cada projeto)</SelectItem>
                    {memberOptions.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name ?? members.nameFor(u.user_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Agendador"
            description="Processa a fila com novas tentativas automáticas."
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge
                status={workerStale ? "onhold" : "open"}
                label={workerStale ? "Sem execução recente" : "Em execução"}
              />
              <span className="text-muted-foreground">
                Último ciclo: {lastRun ? formatDateTime(lastRun.toISOString()) : "nunca"}. Roda no
                próprio banco a cada 2 minutos e não depende da publicação; as ações nas fichas
                aparecem na versão publicada só depois de publicar.
              </span>
            </div>
            <p className="mt-2 text-sm">
              Negócios ganhos antes da ativação:{" "}
              <Link
                to="/projects/settings/imports/reconciliation"
                search={{ tab: "deals" }}
                className="text-primary hover:underline"
              >
                conciliar o histórico
              </Link>
              .
            </p>
          </FormSection>

          <div className="flex justify-end">
            <Button
              disabled={m.isPending || (enabled && !creator)}
              onClick={async () => {
                if (enabled && !q.data?.policy?.enabled) {
                  const ok = await confirmDialog({
                    title: "Ativar a criação automática?",
                    description:
                      "A partir de agora, cada negócio ganho gera ou reconhece um projeto em planejamento. Negócios já ganhos não são reprocessados.",
                    confirmLabel: "Ativar",
                  });
                  if (!ok) return;
                }
                m.mutate();
              }}
            >
              {m.isPending ? "Salvando…" : "Salvar política"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
