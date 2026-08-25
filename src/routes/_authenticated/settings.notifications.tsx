import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  getMyNotificationPrefs,
  updateMyNotificationPrefs,
  type NotificationPrefs,
  type NotificationCategory,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: NotificationsSettingsPage,
});

const CATS: { key: NotificationCategory; label: string; help: string }[] = [
  {
    key: "mention",
    label: "Menções",
    help: "Quando alguém te marca com @ em uma nota, tarefa ou comentário.",
  },
  {
    key: "assignment",
    label: "Atribuições",
    help: "Quando uma tarefa, ticket ou negócio é atribuído a você.",
  },
  {
    key: "deal_stage",
    label: "Mudança de fase",
    help: "Avanço/retrocesso de fase em negócios que você acompanha.",
  },
  {
    key: "ticket",
    label: "Tickets",
    help: "Novos tickets ou atualizações em tickets atribuídos a você.",
  },
  { key: "task", label: "Tarefas", help: "Tarefas vencendo ou criadas para você." },
  { key: "sla", label: "SLA", help: "Alertas de SLA prestes a estourar." },
  {
    key: "message",
    label: "Mensagens",
    help: "Novas mensagens em conversas (WhatsApp, chat, e-mail).",
  },
];

const CHANNELS: { key: keyof NotificationPrefs[NotificationCategory]; label: string }[] = [
  { key: "inapp", label: "No app" },
  { key: "email", label: "E-mail" },
  { key: "sound", label: "Som" },
  { key: "shake", label: "Tremor" },
];

function NotificationsSettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyNotificationPrefs);
  const setFn = useServerFn(updateMyNotificationPrefs);
  const q = useQuery({ queryKey: ["notification-prefs"], queryFn: () => getFn() });
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    if (q.data?.prefs) setPrefs(q.data.prefs);
  }, [q.data]);

  const save = useMutation({
    mutationFn: (p: NotificationPrefs) => setFn({ data: { prefs: p } }),
    onSuccess: () => {
      toast.success("Preferências salvas");
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (
    cat: NotificationCategory,
    channel: keyof NotificationPrefs[NotificationCategory],
    value: boolean,
  ) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [cat]: { ...prefs[cat], [channel]: value } });
  };

  if (q.isLoading || !prefs) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando preferências…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Notificações"
        description="Controle como você é avisado em cada tipo de evento."
      />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium">Evento</th>
                {CHANNELS.map((c) => (
                  <th key={c.key} className="text-center p-3 font-medium w-24">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATS.map((cat) => (
                <tr key={cat.key} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{cat.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{cat.help}</div>
                  </td>
                  {CHANNELS.map((c) => (
                    <td key={c.key} className="p-3 text-center">
                      <Switch
                        checked={prefs[cat.key][c.key]}
                        onCheckedChange={(v) => toggle(cat.key, c.key, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={() => prefs && save.mutate(prefs)} disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        E-mail e som dependem do dispositivo permitir áudio e do destinatário estar com e-mail
        verificado. Som e tremor são lidos no momento em que a notificação chega no sino.
      </p>
    </div>
  );
}
