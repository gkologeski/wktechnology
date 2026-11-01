import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, BellRing, Loader2 } from "lucide-react";
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
  saveMeetingReminderConfig,
  type MeetingReminderConfig,
} from "@/lib/whatsapp/meeting-reminders.functions";
import {
  offsetLabel,
  REMINDER_OFFSETS,
  REMINDER_VARIABLES,
} from "@/lib/whatsapp/meeting-reminders";

type RuleDraft = {
  offset_minutes: number;
  enabled: boolean;
  template_key: string; // name|language
  variable_map: string[];
};

const DEFAULT_SENDER = "__default";
const SAMPLE: Record<string, string> = {
  first_name: "Mariana",
  meeting_date: "05/11/2026",
  meeting_time: "14:00",
  meeting_link: "https://meet.google.com/abc-defg-hij",
  owner_name: "Lia",
  subject: "Apresentação WK",
};
const STATUS_LABEL: Record<string, string> = {
  sending: "Enviando",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Ignorado",
};

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
      REMINDER_OFFSETS.map((o) => {
        const r = d.rules.find((x) => x.offset_minutes === o.minutes);
        return {
          offset_minutes: o.minutes,
          enabled: Boolean(r?.enabled),
          template_key: r ? `${r.template_name}|${r.template_language}` : "",
          variable_map: r?.variable_map ?? [],
        };
      }),
    );
  }, [q.data]);

  const templates = q.data?.templates ?? [];
  const tplByKey = useMemo(
    () => new Map(templates.map((t) => [`${t.name}|${t.language}`, t])),
    [templates],
  );

  const update = (offset: number, patch: Partial<RuleDraft>) =>
    setRules((rs) => rs.map((r) => (r.offset_minutes === offset ? { ...r, ...patch } : r)));

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
                offset_minutes: r.offset_minutes,
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
        description="Envie automaticamente um modelo aprovado na Meta para o cliente antes da reunião. Escolha uma ou mais antecedências."
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
          <p className="text-xs text-text-tertiary">
            Os modelos listados são os aprovados para este número. Ao trocar o número, salve e
            recarregue a página para atualizar a lista.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Quando lembrar"
          description="Vale para atividades do tipo Reunião com contato ou lead que tenha celular de WhatsApp."
        />
        {data.templatesError ? (
          <EmptyState
            compact
            icon={AlertTriangle}
            title="Modelos indisponíveis"
            description={data.templatesError}
          />
        ) : templates.length === 0 ? (
          <EmptyState
            compact
            icon={BellRing}
            title="Nenhum modelo aprovado"
            description="Crie e aprove um modelo na Meta (ex.: “Oi {{1}}, lembrando da nossa reunião às {{2}}”) para usar aqui."
          />
        ) : null}
        {rules.map((r) => {
          const t = tplByKey.get(r.template_key);
          const preview = t
            ? t.body.replace(/\{\{(\d+)\}\}/g, (_m, n) => {
                const k = r.variable_map[Number(n) - 1];
                return k ? (SAMPLE[k] ?? "") : `{{${n}}}`;
              })
            : "";
          const swId = `mr-on-${r.offset_minutes}`;
          return (
            <div
              key={r.offset_minutes}
              className="space-y-3 rounded-lg border border-border-subtle bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <Switch
                  id={swId}
                  checked={r.enabled}
                  onCheckedChange={(v) => update(r.offset_minutes, { enabled: v })}
                  disabled={!canEdit || templates.length === 0}
                />
                <Label htmlFor={swId} className="font-medium">
                  {offsetLabel(r.offset_minutes)}
                </Label>
              </div>
              {r.enabled ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`mr-tpl-${r.offset_minutes}`}>Modelo aprovado</Label>
                    <Select
                      value={r.template_key || undefined}
                      onValueChange={(v) => {
                        const n = tplByKey.get(v)?.variables ?? 0;
                        update(r.offset_minutes, {
                          template_key: v,
                          variable_map: Array.from({ length: n }, (_, i) => r.variable_map[i] ?? ""),
                        });
                      }}
                      disabled={!canEdit}
                    >
                      <SelectTrigger id={`mr-tpl-${r.offset_minutes}`}>
                        <SelectValue placeholder="Escolha um modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((x) => (
                          <SelectItem key={`${x.name}|${x.language}`} value={`${x.name}|${x.language}`}>
                            {x.name} · {x.language}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {r.template_key && !t ? (
                      <p className="text-xs text-destructive">
                        Este modelo não está mais aprovado. Escolha outro.
                      </p>
                    ) : null}
                  </div>
                  {t
                    ? r.variable_map.map((k, i) => (
                        <div key={i} className="space-y-1.5">
                          <Label htmlFor={`mr-var-${r.offset_minutes}-${i}`}>
                            Variável {`{{${i + 1}}}`}
                          </Label>
                          <Select
                            value={k || undefined}
                            onValueChange={(v) =>
                              update(r.offset_minutes, {
                                variable_map: r.variable_map.map((x, j) => (j === i ? v : x)),
                              })
                            }
                            disabled={!canEdit}
                          >
                            <SelectTrigger id={`mr-var-${r.offset_minutes}-${i}`}>
                              <SelectValue placeholder="Escolha o dado" />
                            </SelectTrigger>
                            <SelectContent>
                              {REMINDER_VARIABLES.map((v) => (
                                <SelectItem key={v.key} value={v.key}>
                                  {v.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))
                    : null}
                  {t ? (
                    <div className="md:col-span-2 rounded-md bg-muted p-3 text-sm text-text-secondary">
                      <span className="mb-1 block text-xs font-medium text-text-tertiary">
                        Prévia com dados de exemplo
                      </span>
                      {preview || "(modelo sem texto)"}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
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
