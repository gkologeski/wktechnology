import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getMeetingSettings, saveMeetingSettings } from "@/lib/meetings.functions";

export const Route = createFileRoute("/_authenticated/settings/video")({
  component: VideoSettingsPage,
});

function VideoSettingsPage() {
  const get = useServerFn(getMeetingSettings);
  const save = useServerFn(saveMeetingSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requireConsent, setRequireConsent] = useState(true);
  const [retentionDays, setRetentionDays] = useState(90);
  const [model, setModel] = useState("google/gemini-2.5-flash");

  useEffect(() => {
    (async () => {
      try {
        const { settings } = await get({});
        if (settings?.require_consent !== undefined) setRequireConsent(!!settings.require_consent);
        if (settings?.retention_days) setRetentionDays(settings.retention_days);
        if (settings?.transcription_model) setModel(settings.transcription_model);
      } finally {
        setLoading(false);
      }
    })();
  }, [get]);

  async function submit() {
    setSaving(true);
    try {
      await save({
        data: {
          provider: "jitsi",
          require_consent: requireConsent,
          retention_days: retentionDays,
          transcription_model: model,
        },
      });
      toast.success("Configurações salvas");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Video className="h-5 w-5" /> Vídeo & Reuniões
        </h1>
        <p className="text-sm text-muted-foreground">
          Configurações do provider de vídeo e política de gravação.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <strong>Jitsi Meet</strong> (meet.jit.si) — provider gratuito, sem credenciais. As salas
            são geradas com nomes longos e únicos.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Política de gravação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>Exigir consentimento na criação</Label>
              <p className="text-xs text-muted-foreground">
                Ao criar a sala, marca por padrão a opção de consentimento e exibe aviso ao
                convidado na entrada.
              </p>
            </div>
            <Switch checked={requireConsent} onCheckedChange={setRequireConsent} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="retention">Retenção das gravações (dias)</Label>
            <Input
              id="retention"
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transcrição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="model">Modelo (Lovable AI Gateway)</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="google/gemini-2.5-flash"
            />
            <p className="text-xs text-muted-foreground">
              Modelos recomendados: <code>google/gemini-2.5-flash</code> (rápido) ou
              <code> google/gemini-2.5-pro</code> (qualidade).
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={saving}>
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Salvar
      </Button>
    </div>
  );
}
