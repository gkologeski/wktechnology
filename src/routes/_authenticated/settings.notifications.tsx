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
import { getMyNotificationPrefs, updateMyNotificationPrefs } from "@/lib/notifications.functions";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/lib/notification-catalog";
import {
  normalizeNotificationPrefs,
  notificationPrefsDiff,
  type NotificationPrefs,
} from "@/lib/notification-preferences";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: NotificationsSettingsPage,
});

const CHANNELS: { key: keyof NotificationPrefs[NotificationCategory]; label: string }[] = [
  { key: "inapp", label: "No app" },
  { key: "email", label: "E-mail" },
  { key: "sound", label: "Som" },
  { key: "shake", label: "Tremor" },
];

function NotificationsSettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const getFn = useServerFn(getMyNotificationPrefs);
  const setFn = useServerFn(updateMyNotificationPrefs);
  const q = useQuery({
    queryKey: ["notification-prefs", user?.id],
    queryFn: () => getFn(),
    enabled: Boolean(user?.id),
  });
  const [draft, setDraft] = useState<{ userId: string; prefs: NotificationPrefs } | null>(null);
  const prefs = draft?.userId === user?.id ? (draft?.prefs ?? null) : null;

  useEffect(() => {
    setDraft(
      user?.id && q.data?.prefs
        ? { userId: user.id, prefs: normalizeNotificationPrefs(q.data.prefs) }
        : null,
    );
  }, [user?.id, q.data]);

  const save = useMutation({
    mutationFn: (p: NotificationPrefs) => {
      if (!q.data?.prefs) throw new Error("Recarregue as preferências antes de salvar.");
      return setFn({ data: { prefs: notificationPrefsDiff(q.data.prefs, p) } });
    },
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
    if (!prefs || !user?.id) return;
    setDraft({ userId: user.id, prefs: { ...prefs, [cat]: { ...prefs[cat], [channel]: value } } });
  };

  if (q.isError) {
    return (
      <div className="space-y-3 p-6" role="alert">
        <p>Não foi possível carregar suas preferências de notificações.</p>
        <Button variant="outline" onClick={() => void q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

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
        description="Preferências pessoais dos grupos de avisos existentes."
      />
      <p className="text-sm text-muted-foreground">
        Som e tremor controlam os novos avisos no sino. Desativar “No app” também silencia a
        interrupção, preservando o histórico. E-mail depende de cada fluxo: algumas aprovações e
        automações existentes possuem envio próprio e ainda não consultam estas preferências.
        Alterar um grupo não cria regras nem ativa eventos ou WhatsApp.
      </p>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium">Grupo de avisos</th>
                {CHANNELS.map((c) => (
                  <th key={c.key} className="text-center p-3 font-medium w-24">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_CATEGORIES.map((cat) => (
                <tr key={cat.key} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{cat.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{cat.help}</div>
                  </td>
                  {CHANNELS.map((c) => (
                    <td key={c.key} className="p-3 text-center">
                      <Switch
                        aria-label={`${cat.label}: ${c.label}`}
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
