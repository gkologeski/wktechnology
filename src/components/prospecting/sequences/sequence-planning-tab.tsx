import { useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageCircle, Phone, ShieldCheck, Gauge, Shuffle, GitBranch } from "lucide-react";
import { SEQUENCE_RESOURCE, type SequenceDefinition } from "@/lib/prospecting/sequences/draft";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useWhatsAppSuppressionStats } from "@/hooks/use-whatsapp-suppressions";
import {
  defaultPlanning,
  simulatePlan,
  type SequencePlanning,
} from "@/lib/prospecting/sequences/planning";

type Props = {
  definition: SequenceDefinition;
  disabled: boolean;
  onChange: (d: SequenceDefinition) => void;
};

function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      {label}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          className="h-9"
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        {suffix ? <span className="shrink-0 text-xs">{suffix}</span> : null}
      </div>
    </label>
  );
}

function Radio<T extends string>({
  name,
  value,
  options,
  disabled,
  onChange,
}: {
  name: string;
  value: T;
  options: readonly (readonly [T, string, string?])[];
  disabled: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2" role="radiogroup">
      {options.map(([key, label, hint]) => (
        <label key={key} className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={name}
            className="mt-1"
            checked={value === key}
            disabled={disabled}
            onChange={() => onChange(key)}
          />
          <span>
            {label}
            {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Mail;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" aria-hidden />
          {title}
        </h3>
        {children}
      </CardContent>
    </Card>
  );
}

export function SequencePlanningTab({ definition, disabled: locked, onChange }: Props) {
  const permissions = usePermissions();
  // Edição exige gerenciar sequências; o salvamento continua revalidado no servidor.
  const disabled =
    locked ||
    !permissions.canAny(
      ["own", "team", "workspace"].map((s) => `${SEQUENCE_RESOURCE}.manage.${s}`),
    );
  const planning = definition.planning ?? defaultPlanning();
  const sim = useMemo(
    () => simulatePlan(definition.steps, definition.settings, planning),
    [definition.steps, definition.settings, planning],
  );
  const set = (patch: (p: SequencePlanning) => SequencePlanning) =>
    onChange({ ...definition, planning: patch(structuredClone(planning)) });

  // Modo automático grava a entrada sugerida para o motor usar exatamente o número exibido.
  useEffect(() => {
    if (disabled || !definition.planning || planning.intake.mode !== "auto") return;
    if (planning.intake.dailyIntake !== sim.suggestedIntake)
      set((p) => ({ ...p, intake: { ...p.intake, dailyIntake: sim.suggestedIntake } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.suggestedIntake, planning.intake.mode, disabled, !!definition.planning]);

  const counts = {
    email: definition.steps.filter((s) => s.type === "email").length,
    whatsapp: definition.steps.filter((s) => s.type === "whatsapp").length,
    call: definition.steps.filter((s) => s.type === "call").length,
  };
  const hasCall = counts.call > 0;
  const a = definition.audience;
  const suppression = useWhatsAppSuppressionStats(
    counts.whatsapp > 0 ? permissions.workspaceId : null,
  );
  const blockedTotal =
    (suppression.data?.noWhatsApp ?? 0) + (suppression.data?.engagementLimit ?? 0);

  return (
    <div className="space-y-4">
      {!definition.planning ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Esta sequência ainda usa os limites antigos de “Canais e regras”. Ao alterar qualquer
          campo abaixo e salvar, os limites por canal passam a valer no lugar deles.
        </p>
      ) : null}

      {counts.whatsapp > 0 && blockedTotal > 0 ? (
        <div
          role="status"
          className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-muted-foreground"
        >
          <p className="font-medium text-foreground">
            {blockedTotal} número(s) do workspace estão bloqueados pela Meta no momento
          </p>
          <p className="mt-1">
            {suppression.data?.noWhatsApp ?? 0} sem WhatsApp e{" "}
            {suppression.data?.engagementLimit ?? 0} aguardando nova tentativa (limite de
            engajamento). Quem estiver nessa lista tem a etapa de WhatsApp pulada e segue para o
            próximo passo (e-mail ou ligação). Para reduzir recusas por engajamento, prefira modelos
            de Utilidade e evite repetir marketing para a mesma pessoa em poucos dias.
          </p>
        </div>
      ) : null}

      <Section icon={Gauge} title="1. Capacidade por canal e salva-guarda">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-3 rounded-md border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Mail className="size-4" aria-hidden /> E-mail{" "}
              <Badge variant="secondary">por hora</Badge>
            </p>
            <NumberField
              label="Limite bruto por hora"
              value={planning.email.hourlyLimit}
              min={1}
              max={500}
              suffix="envios/h"
              disabled={disabled}
              onChange={(n) => set((p) => ({ ...p, email: { ...p.email, hourlyLimit: n } }))}
            />
            <NumberField
              label="Salva-guarda"
              value={planning.email.safeguardPct}
              min={5}
              max={90}
              suffix="%"
              disabled={disabled}
              onChange={(n) => set((p) => ({ ...p, email: { ...p.email, safeguardPct: n } }))}
            />
            <p className="text-xs">
              Teto seguro: <strong>{sim.emailHourCap}/hora</strong> · {sim.emailDayCap}/dia em{" "}
              {Math.round(sim.hoursPerDay * 10) / 10} h de expediente
            </p>
          </div>
          <div className="space-y-3 rounded-md border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="size-4" aria-hidden /> WhatsApp{" "}
              <Badge variant="secondary">por dia</Badge>
            </p>
            <NumberField
              label="Limite bruto por dia"
              value={planning.whatsapp.dailyLimit}
              min={1}
              max={10000}
              suffix="envios/dia"
              disabled={disabled}
              onChange={(n) => set((p) => ({ ...p, whatsapp: { ...p.whatsapp, dailyLimit: n } }))}
            />
            <NumberField
              label="Salva-guarda"
              value={planning.whatsapp.safeguardPct}
              min={5}
              max={90}
              suffix="%"
              disabled={disabled}
              onChange={(n) => set((p) => ({ ...p, whatsapp: { ...p.whatsapp, safeguardPct: n } }))}
            />
            <p className="text-xs">
              Teto seguro: <strong>{sim.whatsappDayCap}/dia</strong> · reserva de{" "}
              {planning.whatsapp.dailyLimit - sim.whatsappDayCap}
            </p>
          </div>
          <div className="space-y-3 rounded-md border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Phone className="size-4" aria-hidden /> Ligações
            </p>
            <p className="text-sm">Sem limite de cota.</p>
            <p className="text-xs text-muted-foreground">
              As ligações seguem o intervalo por conta definido em “Canais e regras”.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Os limites valem por conta remetente e somam todas as sequências que usam a mesma conta.
        </p>
      </Section>

      <Section icon={Shuffle} title="2. Espaçamento aleatório entre envios de WhatsApp">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Intervalo mínimo"
            value={planning.whatsapp.minIntervalSeconds}
            min={5}
            max={3600}
            suffix="s"
            disabled={disabled}
            onChange={(n) =>
              set((p) => ({
                ...p,
                whatsapp: {
                  ...p.whatsapp,
                  minIntervalSeconds: n,
                  maxIntervalSeconds: Math.max(n, p.whatsapp.maxIntervalSeconds),
                },
              }))
            }
          />
          <NumberField
            label="Intervalo máximo"
            value={planning.whatsapp.maxIntervalSeconds}
            min={planning.whatsapp.minIntervalSeconds}
            max={3600}
            suffix="s"
            disabled={disabled}
            onChange={(n) =>
              set((p) => ({ ...p, whatsapp: { ...p.whatsapp, maxIntervalSeconds: n } }))
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Cada contato recebe um intervalo sorteado nessa faixa desde o último envio da conta. Como
          a fila é verificada a cada 2 minutos, intervalos curtos podem sair um pouco depois.
        </p>
      </Section>

      <Section icon={ShieldCheck} title="3. Proteção comercial e contato recente">
        <fieldset disabled={disabled} className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Na entrada do público</p>
          {(
            [
              ["excludeCustomers", "Excluir clientes atuais"],
              ["excludeOpenDeals", "Excluir contatos com negociação aberta"],
              ["excludeOtherSequences", "Excluir contatos em outra sequência ativa"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={a[key]}
                onChange={(e) =>
                  onChange({ ...definition, audience: { ...a, [key]: e.target.checked } })
                }
              />
              {label}
            </label>
          ))}
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={planning.recent.entryWhatsappDays > 0}
              onChange={(e) =>
                set((p) => ({
                  ...p,
                  recent: { ...p.recent, entryWhatsappDays: e.target.checked ? 14 : 0 },
                }))
              }
            />
            Excluir quem recebeu WhatsApp nos últimos
            <Input
              type="number"
              aria-label="Dias sem WhatsApp na entrada"
              className="h-8 w-20"
              min={1}
              max={90}
              value={planning.recent.entryWhatsappDays || 14}
              disabled={disabled || planning.recent.entryWhatsappDays === 0}
              onChange={(e) =>
                set((p) => ({
                  ...p,
                  recent: {
                    ...p.recent,
                    entryWhatsappDays: Math.min(90, Math.max(1, Number(e.target.value) || 1)),
                  },
                }))
              }
            />
            dias
          </label>
          <p className="pt-2 text-xs font-medium text-muted-foreground">
            Durante a execução (no momento de cada etapa)
          </p>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={planning.recent.skipWhatsappDays > 0}
              onChange={(e) =>
                set((p) => ({
                  ...p,
                  recent: { ...p.recent, skipWhatsappDays: e.target.checked ? 7 : 0 },
                }))
              }
            />
            Pular a etapa de WhatsApp se o contato recebeu mensagem nos últimos
            <Input
              type="number"
              aria-label="Dias para pular WhatsApp"
              className="h-8 w-20"
              min={1}
              max={90}
              value={planning.recent.skipWhatsappDays || 7}
              disabled={disabled || planning.recent.skipWhatsappDays === 0}
              onChange={(e) =>
                set((p) => ({
                  ...p,
                  recent: {
                    ...p.recent,
                    skipWhatsappDays: Math.min(90, Math.max(1, Number(e.target.value) || 1)),
                  },
                }))
              }
            />
            dias
          </label>
          <p className="text-xs text-muted-foreground">
            Mensagens enviadas por esta mesma sequência não contam. A etapa pulada fica registrada
            no histórico e o contato segue para a próxima etapa.
          </p>
        </fieldset>
      </Section>

      <Section icon={Gauge} title="4. Simulador de entrada diária">
        <p className="text-sm text-muted-foreground">
          Fluxo atual: {counts.email} e-mail(s), {counts.whatsapp} WhatsApp(s), {counts.call}{" "}
          ligação(ões). Expediente {definition.settings.start}–{definition.settings.end}.
        </p>
        <Radio
          name="intake-mode"
          value={planning.intake.mode}
          disabled={disabled}
          onChange={(mode) => set((p) => ({ ...p, intake: { ...p.intake, mode } }))}
          options={[
            [
              "auto",
              `Sugestão automática: ${sim.suggestedIntake} novos contatos por dia`,
              "Maior entrada diária que mantém o pico acumulado dentro dos tetos seguros.",
            ],
            ["manual", "Entrada manual fixa"],
          ]}
        />
        {planning.intake.mode === "manual" ? (
          <div className="max-w-xs">
            <NumberField
              label="Novos contatos por dia"
              value={planning.intake.dailyIntake}
              min={1}
              max={1000}
              disabled={disabled}
              onChange={(n) => set((p) => ({ ...p, intake: { ...p.intake, dailyIntake: n } }))}
            />
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              [
                "E-mail (pico)",
                `${sim.peak.emailPerHour}/h`,
                `teto ${sim.emailHourCap}/h`,
                sim.exceeds.email,
              ],
              [
                "WhatsApp (pico)",
                `${sim.peak.whatsapp}/dia`,
                `teto ${sim.whatsappDayCap}/dia`,
                sim.exceeds.whatsapp,
              ],
              ["Ligações (pico)", `${sim.peak.call}/dia`, "sem teto", false],
            ] as const
          ).map(([label, value, hint, over]) => (
            <div
              key={label}
              className={`rounded-md border p-3 ${over ? "border-destructive bg-destructive/5" : ""}`}
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold">{value}</p>
              <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
                {over ? `Acima do ${hint}` : hint}
              </p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Carga projetada por dia</caption>
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Dia</th>
                <th className="py-1 text-right font-medium">E-mails</th>
                <th className="py-1 text-right font-medium">Por hora</th>
                <th className="py-1 text-right font-medium">WhatsApp</th>
                <th className="py-1 text-right font-medium">Ligações</th>
              </tr>
            </thead>
            <tbody>
              {sim.days.map((d) => (
                <tr key={d.day} className="border-t">
                  <td className="py-1">Dia {d.day}</td>
                  <td className="py-1 text-right">{d.email}</td>
                  <td className="py-1 text-right">
                    {Math.round((d.email / sim.hoursPerDay) * 10) / 10}
                  </td>
                  <td className="py-1 text-right">{d.whatsapp}</td>
                  <td className="py-1 text-right">{d.call}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Projeção considerando que cerca de 85% dos contatos seguem para cada toque seguinte. A
          partir do último dia mostrado a carga fica estável.
        </p>
      </Section>

      <Section icon={GitBranch} title="5. Transbordo quando o limite for atingido">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Se o e-mail atingir o teto da hora</p>
            <Radio
              name="email-limit"
              value={planning.email.onLimit}
              disabled={disabled}
              onChange={(onLimit) => set((p) => ({ ...p, email: { ...p.email, onLimit } }))}
              options={[
                ["queue_next_hour", "Enfileirar para a próxima hora"],
                [
                  "prioritize_followups",
                  "Priorizar follow-ups",
                  "Ao chegar a 70% do teto, novos contatos esperam e só follow-ups saem.",
                ],
              ]}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Se o WhatsApp atingir o teto do dia</p>
            <Radio
              name="whatsapp-limit"
              value={planning.whatsapp.onLimit}
              disabled={disabled}
              onChange={(onLimit) => set((p) => ({ ...p, whatsapp: { ...p.whatsapp, onLimit } }))}
              options={[
                ["queue_next_day", "Enfileirar para o dia seguinte"],
                [
                  "overflow_to_call",
                  "Transbordar para a próxima ligação",
                  hasCall
                    ? "Pula o WhatsApp e as esperas até a próxima etapa de ligação."
                    : "Não há ligação no fluxo: a etapa de WhatsApp será apenas pulada.",
                ],
                ["skip_step", "Pular a etapa de WhatsApp e seguir o fluxo"],
              ]}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
