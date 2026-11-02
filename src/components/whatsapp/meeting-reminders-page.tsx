import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, BellRing, Loader2, Plus } from "lucide-react";
import { PageHeader, SectionHeader, EmptyState, Skeletons } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  getMeetingReminderConfig,
  listMeetingReminderTemplates,
  saveMeetingReminderConfig,
  type MeetingReminderConfig,
} from "@/lib/whatsapp/meeting-reminders.functions";
import {
  fromMinutes,
  MAX_OFFSET_MINUTES,
  MAX_REMINDER_RULES,
  MIN_OFFSET_MINUTES,
  offsetLabel,
  toMinutes,
} from "@/lib/whatsapp/meeting-reminders";
import { MeetingReminderRuleRow, type RuleDraft } from "./meeting-reminder-rule-row";

const DEFAULT_SENDER = "__default";
const STATUS_LABEL: Record<string, string> = {
  sending: "Enviando",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Ignorado",
};
let uidSeq = 0;
const newUid = () => `r${++uidSeq}`;

export function MeetingRemindersPage() {
  const getFn = useServerFn(getMeetingReminderConfig);
  const saveFn = useServerFn(saveMeetingReminderConfig);
  const qc = useQueryClient();
  const { can, isLoading: permLoading } = usePermissions();
  const canEdit = can("techsales.meeting_settings.update.workspace");
  const q = useQuery({ queryKey: ["meeting-reminder-config"], queryFn: () => getFn() });

  const [enabled, setEnabled] = useState(false);
  const [sender, setSender] = useState<string>(DEFAULT_SENDER);
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = q.data;
    if (!d) return;
    setEnabled(d.enabled);
    setSender(d.sender_phone_number_id ?? DEFAULT_SENDER);
    setRules(
      [...d.rules]
        .sort((x, y) => y.offset_minutes - x.offset_minutes)
        .map((r) => {
          const { amount, unit } = fromMinutes(r.offset_minutes, r.offset_unit);
          return {
            uid: newUid(),
            amount,
            unit,
            enabled: r.enabled,
            template_key: `${r.template_name}|${r.template_language}`,
            variable_map: r.variable_map,
          };
        }),
    );
  }, [q.data]);

  const savedSender = q.data ? (q.data.sender_phone_number_id ?? DEFAULT_SENDER) : null;
  const tplFn = useServerFn(listMeetingReminderTemplates);
  const tq = useQuery({
    queryKey: ["meeting-reminder-templates", sender],
    queryFn: () => tplFn({ data: { sender: sender === DEFAULT_SENDER ? null : sender } }),
    enabled: Boolean(q.data) && sender !== savedSender,
  });
  const usingSaved = sender === savedSender;
  const templates = useMemo(
    () => (usingSaved ? (q.data?.templates ?? []) : (tq.data?.templates ?? [])),
    [usingSaved, q.data, tq.data],
  );
  const templatesError = usingSaved
    ? (q.data?.templatesError ?? null)
    : tq.isError
      ? tq.error instanceof Error
        ? tq.error.message
        : "Não foi possível carregar os modelos."
      : (tq.data?.templatesError ?? null);
  const templatesLoading = !usingSaved && tq.isLoading;
  const tplByKey = useMemo(
    () => new Map(templates.map((t) => [`${t.name}|${t.language}`, t])),
    [templates],
  );

  const update = (uid: string, patch: Partial<RuleDraft>) =>
    setRules((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  const minutesOf = (r: RuleDraft) =>
    Number.isFinite(r.amount) ? toMinutes(r.amount, r.unit) : NaN;
  const outOfRange = (r: RuleDraft) => {
    const m = minutesOf(r);
    return !Number.isFinite(m) || m < MIN_OFFSET_MINUTES || m > MAX_OFFSET_MINUTES;
  };
  const counts = new Map<number, number>();
  for (const r of rules) counts.set(minutesOf(r), (counts.get(minutesOf(r)) ?? 0) + 1);
  const isDup = (r: RuleDraft) => (counts.get(minutesOf(r)) ?? 0) > 1;

  const save = async () => {
    setSaving(true);
    try {
      await saveFn({
        data: {
          enabled,
          sender_phone_number_id: sender === DEFAULT_SENDER ? null : sender,
          rules: rules
            .filter((r) => r.template_key)
            .map((r) => {
              const [name, language] = r.template_key.split("|");
              return {
                offset_minutes: minutesOf(r),
                offset_unit: r.unit,
                enabled: r.enabled,
                template_name: name!,
                template_language: language!,
                variable_map: r.variable_map,
              };
            }),
        },
      });
      toast.success("Lembretes salvos.");
      await qc.invalidateQueries({ queryKey: ["meeting-reminder-config"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const invalid = rules.some((r) => {
    if (outOfRange(r) || isDup(r)) return true;
    if (!r.enabled) return false;
    const t = tplByKey.get(r.template_key);
    return !t || r.variable_map.length !== t.variables || r.variable_map.some((v) => !v);
  });

  if (q.isLoading || permLoading)
    return (
      <div className="space-y-6 p-6">
        <Skeletons.Card />
      </div>
    );
  if (q.isError)
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar os lembretes"
          description={q.error instanceof Error ? q.error.message : "Tente novamente."}
          action={<Button onClick={() => q.refetch()}>Tentar novamente</Button>}
        />
      </div>
    );

  const data = q.data as MeetingReminderConfig;
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        eyebrow="Configurações"
        title="Lembretes de reunião (WhatsApp)"
        description="Envie automaticamente um modelo aprovado na Meta para o cliente antes da reunião. Adicione quantos lembretes quiser (até 10), de 1 minuto a 30 dias antes."
        primaryAction={
          <Button onClick={save} disabled={!canEdit || saving || invalid}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Salvar
          </Button>
        }
      />

      {!canEdit ? (
        <p className="text-sm text-text-secondary" role="status">
          Você pode ver esta configuração, mas não alterá-la.
        </p>
      ) : null}

      <section className="space-y-4 rounded-lg border border-border-subtle bg-card p-5">
        <SectionHeader title="Geral" />
        <div className="flex items-center gap-3">
          <Switch
            id="mr-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!canEdit}
          />
          <Label htmlFor="mr-enabled">Ativar lembretes de reunião</Label>
        </div>
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="mr-sender">Número que envia</Label>
          <Select value={sender} onValueChange={setSender} disabled={!canEdit}>
            <SelectTrigger id="mr-sender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_SENDER}>Padrão (número da conversa)</SelectItem>
              {data.senders.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-text-tertiary" aria-live="polite">
            {templatesLoading
              ? "Carregando os modelos aprovados deste número…"
              : "Os modelos listados são os aprovados para este número."}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Quando lembrar"
          description="Vale para atividades do tipo Reunião com contato ou lead que tenha celular de WhatsApp."
        />
        {templatesLoading ? (
          <Skeletons.Card />
        ) : templatesError ? (
          <EmptyState
            compact
            icon={AlertTriangle}
            title="Modelos indisponíveis"
            description={templatesError}
          />
        ) : templates.length === 0 ? (
          <EmptyState
            compact
            icon={BellRing}
            title="Nenhum modelo aprovado para este número"
            description="Crie e aprove um modelo na Meta (ex.: “Oi {{1}}, lembrando da nossa reunião às {{2}}”) para usar aqui."
          />
        ) : null}
        {rules.length === 0 ? (
          <EmptyState
            compact
            icon={BellRing}
            title="Nenhum lembrete"
            description="Adicione um lembrete e escolha quanto tempo antes da reunião ele sai."
          />
        ) : null}
        {rules.map((r, i) => (
          <MeetingReminderRuleRow
            key={r.uid}
            rule={r}
            index={i}
            templates={templates}
            tplByKey={tplByKey}
            locked={saving}
            duplicate={isDup(r)}
            outOfRange={outOfRange(r)}
            onChange={(patch) => update(r.uid, patch)}
            onRemove={() => setRules((rs) => rs.filter((x) => x.uid !== r.uid))}
          />
        ))}
        <Button
          variant="outline"
          onClick={() =>
            setRules((rs) => [
              ...rs,
              {
                uid: newUid(),
                amount: 1,
                unit: "hours",
                enabled: true,
                template_key: "",
                variable_map: [],
              },
            ])
          }
          disabled={!canEdit || rules.length >= MAX_REMINDER_RULES}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Adicionar lembrete
        </Button>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Últimos envios" />
        {data.recent.length === 0 ? (
          <EmptyState compact icon={BellRing} title="Nenhum lembrete enviado ainda" />
        ) : (
          <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-card">
            {data.recent.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <Badge variant={d.status === "failed" ? "destructive" : "secondary"}>
                  {STATUS_LABEL[d.status] ?? d.status}
                </Badge>
                <span>{offsetLabel(d.offset_minutes)}</span>
                <span className="text-text-tertiary">
                  Reunião em {new Date(d.meeting_at).toLocaleString("pt-BR")}
                </span>
                {d.error ? <span className="text-text-secondary">— {d.error}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
