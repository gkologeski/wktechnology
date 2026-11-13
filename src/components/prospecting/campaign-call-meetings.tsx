import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FormSection } from "@/components/techhire/ui";
import { CampaignAssignmentSection } from "@/components/whatsapp/campaign-assignment-section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { listCallFollowupTemplates, listMeetingHosts } from "@/lib/prospecting-campaigns.functions";
import {
  MEETING_ASSIGNMENT_HELP,
  MEETING_ASSIGNMENT_LABELS,
  type MeetingAssignment,
} from "@/lib/prospecting/calls/meeting-assignment";

/** Seção "Distribuição das reuniões" — mesma composição da campanha de WhatsApp. */
export function CampaignCallMeetings({
  value,
  senderId,
  disabled,
  onChange,
}: {
  value: MeetingAssignment;
  senderId: string | null;
  disabled?: boolean;
  onChange: (v: MeetingAssignment) => void;
}) {
  // Sem criar/editar campanhas, a seção fica só leitura (o servidor também barra).
  const permissions = usePermissions();
  disabled =
    disabled ||
    !permissions.canAny(
      ["create", "update"].flatMap((a) =>
        ["own", "team", "workspace"].map((sc) => `techsales.marketing.campaigns.${a}.${sc}`),
      ),
    );
  const { data: members = [] } = useWorkspaceMembers();
  const hostsFn = useServerFn(listMeetingHosts);
  const templatesFn = useServerFn(listCallFollowupTemplates);
  const hosts = useQuery({ queryKey: ["call-meeting-hosts"], queryFn: () => hostsFn() });
  const templates = useQuery({
    queryKey: ["call-meeting-templates", senderId],
    queryFn: () => templatesFn({ data: { senderId } }),
    enabled: value.meeting_assignment_mode !== "unassigned",
  });
  const withCal = new Set(hosts.data?.userIds ?? []);
  const eligible = members.filter((m) => withCal.has(m.user_id));
  const missing = members.filter((m) => !withCal.has(m.user_id));
  const off = value.meeting_assignment_mode === "unassigned";
  const tplKey = value.meeting_template_name
    ? `${value.meeting_template_name}|${value.meeting_template_language ?? "pt_BR"}`
    : "";

  return (
    <div className="space-y-2">
      <FormSection
        title="Distribuição das reuniões"
        description="Na agenda de quem a assistente de voz marca a reunião durante a ligação."
        className="gap-3 py-4 md:grid-cols-1"
      >
        {hosts.isLoading ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Carregando quem tem agenda conectada…
          </p>
        ) : hosts.isError ? (
          <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
            Não foi possível carregar quem tem agenda conectada.
            <Button size="sm" variant="outline" onClick={() => hosts.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <>
            <CampaignAssignmentSection
              mode={value.meeting_assignment_mode}
              memberIds={value.meeting_member_ids}
              members={eligible}
              disabled={disabled}
              labels={MEETING_ASSIGNMENT_LABELS}
              help={MEETING_ASSIGNMENT_HELP}
              onChange={(m, ids) =>
                onChange({ ...value, meeting_assignment_mode: m, meeting_member_ids: ids })
              }
            />
            {!off && missing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sem agenda conectada (não aparecem para escolha):{" "}
                {missing.map((m) => m.full_name?.trim() || "Sem nome").join(", ")}. Conecte a agenda
                em Configurações › Agendas.
              </p>
            )}
          </>
        )}
      </FormSection>
      {!off && (
        <FormSection
          title="Reunião"
          description="Duração, até quantos dias à frente oferecer e o modelo do WhatsApp com o link."
          className="gap-3 py-4 md:grid-cols-1"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="meet-duration" className="text-xs text-muted-foreground">
                Duração (minutos)
              </label>
              <Input
                id="meet-duration"
                type="number"
                min={15}
                max={120}
                step={15}
                disabled={disabled}
                value={value.meeting_duration_minutes}
                onChange={(e) =>
                  onChange({
                    ...value,
                    meeting_duration_minutes: Math.min(
                      120,
                      Math.max(15, Number(e.target.value) || 30),
                    ),
                  })
                }
              />
            </div>
            <div>
              <label htmlFor="meet-horizon" className="text-xs text-muted-foreground">
                Oferecer horários nos próximos (dias)
              </label>
              <Input
                id="meet-horizon"
                type="number"
                min={1}
                max={30}
                disabled={disabled}
                value={value.meeting_horizon_days}
                onChange={(e) =>
                  onChange({
                    ...value,
                    meeting_horizon_days: Math.min(30, Math.max(1, Number(e.target.value) || 7)),
                  })
                }
              />
            </div>
          </div>
          <div>
            <label htmlFor="meet-template" className="text-xs text-muted-foreground">
              Modelo aprovado com o link da reunião (remetente do Pós-ligação)
            </label>
            {templates.isLoading ? (
              <p className="text-xs text-muted-foreground">Carregando modelos…</p>
            ) : templates.data?.error || templates.isError ? (
              <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
                Não foi possível carregar os modelos deste remetente.
                <Button size="sm" variant="outline" onClick={() => templates.refetch()}>
                  Tentar de novo
                </Button>
              </div>
            ) : (templates.data?.items.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum modelo aprovado neste remetente. Escolha outro remetente no Pós-ligação.
              </p>
            ) : (
              <Select
                value={tplKey}
                disabled={disabled}
                onValueChange={(v) => {
                  const [name, language] = v.split("|");
                  onChange({
                    ...value,
                    meeting_template_name: name,
                    meeting_template_language: language,
                  });
                }}
              >
                <SelectTrigger id="meet-template">
                  <SelectValue placeholder="Escolha o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {templates.data!.items.map((t) => (
                    <SelectItem key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </FormSection>
      )}
    </div>
  );
}
