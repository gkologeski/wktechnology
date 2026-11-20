import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACTIVITY_TIME_OPTIONS } from "@/lib/activity-date-time";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/lib/notification-catalog";
import type { NotificationPrefs } from "@/lib/notification-preferences";
import {
  AVAILABLE_NOTIFICATION_EVENTS,
  centerSettingsSchema,
  diffCenterSettings,
  effectiveChannels,
  effectiveWhatsAppPreference,
  type CenterSettings,
  type CenterSettingsPatch,
  type AvailableEventKey,
  type WorkspaceNotificationChannels,
} from "@/lib/notification-center-preferences";

type Props = {
  legacyPrefs: NotificationPrefs;
  settings: CenterSettings;
  revision: number;
  onSave: (patch: CenterSettingsPatch, revision: number) => Promise<unknown>;
};
const CHANNELS = [
  { key: "inapp", label: "No app" },
  { key: "email", label: "E-mail" },
  { key: "sound", label: "Som" },
  { key: "shake", label: "Tremor" },
  { key: "whatsapp", label: "WhatsApp oficial" },
] as const;
const inherited = (value: boolean | undefined) => (value === undefined ? "inherit" : String(value));

function PreferenceChoice({
  label,
  value,
  onChange,
  whatsapp = false,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  whatsapp?: boolean;
}) {
  return (
    <Select
      value={inherited(value)}
      onValueChange={(next) => onChange(next === "inherit" ? undefined : next === "true")}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="inherit">
          {whatsapp ? "Herdar autorização pessoal" : "Herdar"}
        </SelectItem>
        <SelectItem value="true">{whatsapp ? "Permitir pela preferência" : "Ativado"}</SelectItem>
        <SelectItem value="false">
          {whatsapp ? "Bloquear pela preferência" : "Desativado"}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function QuietTime({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const options: readonly string[] = ACTIVITY_TIME_OPTIONS.includes(value)
    ? ACTIVITY_TIME_OPTIONS
    : [value, ...ACTIVITY_TIME_OPTIONS];
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((time) => (
            <SelectItem key={time} value={time}>
              {time}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Personal workspace overlay. Parent keys this panel by user/workspace identity. */
export function NotificationPreferencesPanel({ legacyPrefs, settings, revision, onSave }: Props) {
  const [editor, setEditor] = useState(() => ({
    baseline: structuredClone(settings),
    draft: structuredClone(settings),
    revision,
  }));
  const [eventKey, setEventKey] = useState<AvailableEventKey>("legacy.mention");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (editor.revision !== revision) {
      setEditor({
        baseline: structuredClone(settings),
        draft: structuredClone(settings),
        revision,
      });
      setMessage("");
      setError("");
    }
  }, [editor.revision, revision, settings]);
  const draft = editor.draft;
  const dirty = JSON.stringify(editor.baseline) !== JSON.stringify(draft);
  const edit = (next: CenterSettings) => {
    setEditor((current) => ({ ...current, draft: next }));
    setMessage("");
    setError("");
  };
  const setChannel = (
    section: "categories" | "eventOverrides",
    key: string,
    channel: keyof WorkspaceNotificationChannels,
    value: boolean | undefined,
  ) => {
    const groups = { ...draft[section] } as Record<string, Partial<WorkspaceNotificationChannels>>;
    const channels = { ...groups[key] };
    if (value === undefined) delete channels[channel];
    else channels[channel] = value;
    if (Object.keys(channels).length) groups[key] = channels;
    else delete groups[key];
    edit({ ...draft, [section]: groups });
  };
  const resetCategory = (category: NotificationCategory) => {
    const categories = { ...draft.categories };
    delete categories[category];
    edit({ ...draft, categories });
  };
  const selectedEvent = AVAILABLE_NOTIFICATION_EVENTS.find((event) => event.eventKey === eventKey)!;
  const effective = effectiveChannels(legacyPrefs, draft, eventKey);
  const whatsappPreference = effectiveWhatsAppPreference(draft, eventKey);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const valid = centerSettingsSchema.safeParse(draft);
    if (!valid.success) {
      setError(valid.error.issues[0]?.message ?? "Revise as preferências.");
      return;
    }
    if (!dirty || pending) return;
    const snapshot = structuredClone(draft);
    setPending(true);
    setError("");
    setMessage("");
    try {
      await onSave(diffCenterSettings(editor.baseline, snapshot), editor.revision);
      setEditor((current) => ({ ...current, baseline: snapshot }));
      setMessage("Preferências deste workspace salvas.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar. Seu rascunho foi preservado.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="min-w-0 max-w-full space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Preferências deste workspace</h2>
        <p className="text-sm text-muted-foreground">
          Herdar mantém a preferência pessoal geral. Estas escolhas não mudam tarefas, alçadas ou
          prazos.
        </p>
      </div>
      <fieldset disabled={pending} className="min-w-0 max-w-full space-y-4">
        <legend className="mb-3 font-medium">Grupos de avisos</legend>
        <div className="relative min-w-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium">Grupo</th>
                {CHANNELS.map((channel) => (
                  <th key={channel.key} className="px-2 pb-3 font-medium">
                    {channel.label}
                  </th>
                ))}
                <th className="pb-3">
                  <span className="sr-only">Restaurar herança</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_CATEGORIES.map((category) => (
                <tr key={category.key} className="border-b last:border-0">
                  <td className="py-3 pr-3">
                    <div className="font-medium">{category.label}</div>
                    <div className="max-w-72 text-xs text-muted-foreground">{category.help}</div>
                  </td>
                  {CHANNELS.map((channel) => (
                    <td className="px-2 py-3" key={channel.key}>
                      <PreferenceChoice
                        label={`${category.label}: ${channel.label}`}
                        whatsapp={channel.key === "whatsapp"}
                        value={draft.categories[category.key]?.[channel.key]}
                        onChange={(value) =>
                          setChannel("categories", category.key, channel.key, value)
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!draft.categories[category.key]}
                      aria-label={`Herdar grupo ${category.label}`}
                      onClick={() => resetCategory(category.key)}
                    >
                      Herdar grupo
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Desativar “No app” suprime novos avisos nesse canal e silencia as interrupções do sino.
          E-mail possui uma escolha própria. O histórico é preservado e produtores legados ainda
          podem possuir regras independentes. WhatsApp oficial pode ser bloqueado por grupo ou
          evento; permitir pela preferência não substitui a sua autorização pessoal, a política ou a
          configuração da regra.
        </p>
      </fieldset>

      <fieldset disabled={pending} className="min-w-0 max-w-full space-y-4">
        <legend className="mb-3 font-medium">Exceção por evento</legend>
        <p className="text-sm text-muted-foreground">
          A escolha do evento prevalece sobre o grupo neste workspace. O catálogo não ativa eventos
          novos.
        </p>
        <Select value={eventKey} onValueChange={(value) => setEventKey(value as AvailableEventKey)}>
          <SelectTrigger aria-label="Evento da preferência">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABLE_NOTIFICATION_EVENTS.map((event) => (
              <SelectItem key={event.eventKey} value={event.eventKey}>
                {event.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Eventos comerciais e contratuais dependem de uma regra publicada e ativa. Apenas escolher
          uma preferência não cria avisos. Som e tremor desses eventos começam desligados; uma
          escolha explícita no grupo ou evento deste workspace pode habilitá-los.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {CHANNELS.map((channel) => (
            <div className="space-y-2" key={channel.key}>
              <Label>{channel.label}</Label>
              <PreferenceChoice
                label={`${selectedEvent.label}: ${channel.label}`}
                whatsapp={channel.key === "whatsapp"}
                value={draft.eventOverrides[eventKey]?.[channel.key]}
                onChange={(value) => setChannel("eventOverrides", eventKey, channel.key, value)}
              />
              <p className="text-xs text-muted-foreground">
                {channel.key === "whatsapp"
                  ? whatsappPreference === false
                    ? "Preferência: bloquear este canal."
                    : whatsappPreference === true
                      ? "Preferência: permitir; autorização pessoal e demais condições ainda exigidas."
                      : "Preferência: herdar autorização pessoal e demais condições do canal."
                  : `Efetivo: ${effective[channel.key] ? "ativado" : "desativado"}`}
              </p>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={!draft.eventOverrides[eventKey]}
          onClick={() => {
            const eventOverrides = { ...draft.eventOverrides };
            delete eventOverrides[eventKey];
            edit({ ...draft, eventOverrides });
          }}
        >
          Herdar opções do evento
        </Button>
      </fieldset>

      <fieldset disabled={pending} className="min-w-0 max-w-full space-y-4">
        <legend className="mb-3 font-medium">Horário de silêncio</legend>
        <div className="flex items-center gap-3">
          <Switch
            id="center-quiet-enabled"
            checked={draft.quiet.enabled}
            onCheckedChange={(enabled) => edit({ ...draft, quiet: { ...draft.quiet, enabled } })}
          />
          <Label htmlFor="center-quiet-enabled">Silenciar interrupções durante este período</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Pop-up, som e tremor são silenciados e os novos envios externos integrados aguardam o
          período permitido. A central continua disponível e os prazos continuam correndo.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <QuietTime
            label="Início do silêncio"
            value={draft.quiet.start}
            disabled={!draft.quiet.enabled}
            onChange={(start) => edit({ ...draft, quiet: { ...draft.quiet, start } })}
          />
          <QuietTime
            label="Fim do silêncio"
            value={draft.quiet.end}
            disabled={!draft.quiet.enabled}
            onChange={(end) => edit({ ...draft, quiet: { ...draft.quiet, end } })}
          />
          <div className="space-y-2">
            <Label htmlFor="center-quiet-timezone">Fuso horário IANA</Label>
            <Input
              id="center-quiet-timezone"
              value={draft.quiet.timezone}
              onChange={(event) =>
                edit({ ...draft, quiet: { ...draft.quiet, timezone: event.target.value } })
              }
              placeholder="America/Sao_Paulo"
            />
          </div>
        </div>
      </fieldset>

      <fieldset disabled={pending} className="min-w-0 max-w-full space-y-4">
        <legend className="mb-3 font-medium">Organização da central</legend>
        <Select
          value={draft.summary}
          onValueChange={(summary) =>
            edit({ ...draft, summary: summary as CenterSettings["summary"] })
          }
        >
          <SelectTrigger aria-label="Agrupamento da central">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem agrupamento</SelectItem>
            <SelectItem value="daily">Por dia</SelectItem>
            <SelectItem value="weekly">Por semana, a partir de segunda-feira</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Agrupa os avisos carregados usando o fuso configurado. Não agenda nem envia resumo por
          e-mail ou WhatsApp.
        </p>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        E-mail usa sua preferência efetiva nos passos de notificação integrados e depende da
        política do workspace. Outros produtores legados mantêm suas regras. WhatsApp exige a
        autorização pessoal específica abaixo; ativar um grupo não cria nenhum opt-in de WhatsApp.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar preferências do workspace
        </Button>
      </div>
    </form>
  );
}
