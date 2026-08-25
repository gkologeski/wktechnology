// Dialog para agendar entrevista — manual ou enviar link de auto-agendamento.
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { scheduleInterview, createSelfScheduleLink } from "@/lib/ats/interviews.functions";
import { listInterviewKits } from "@/lib/ats/interview-kits.functions";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { getAppUrl } from "@/lib/app-url";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicationId: string;
  candidateName: string;
  onSaved?: () => void;
};

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  applicationId,
  candidateName,
  onSaved,
}: Props) {
  const schedule = useServerFn(scheduleInterview);
  const createLink = useServerFn(createSelfScheduleLink);
  const listKits = useServerFn(listInterviewKits);
  const { data: members = [] } = useWorkspaceMembers();

  const [tab, setTab] = useState<"manual" | "self">("manual");
  const [saving, setSaving] = useState(false);
  const [kits, setKits] = useState<Array<{ id: string; name: string }>>([]);
  const [kitId, setKitId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    listKits()
      .then((rows) => setKits(rows.map((k) => ({ id: k.id as string, name: k.name as string }))))
      .catch(() => undefined);
  }, [open, listKits]);

  // manual
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState(45);
  const [kind, setKind] = useState<"phone" | "video" | "onsite" | "async">("video");
  const [interviewer, setInterviewer] = useState<string>("");
  const [meetUrl, setMeetUrl] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // self-schedule
  const [slotsText, setSlotsText] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const handleManual = async () => {
    if (!when) {
      toast.error("Escolha data e horário");
      return;
    }
    setSaving(true);
    try {
      const res = await schedule({
        data: {
          application_id: applicationId,
          interviewer_id: interviewer || null,
          kind,
          scheduled_at: new Date(when).toISOString(),
          duration_min: duration,
          meet_url: meetUrl || null,
          location: location || null,
          notes: notes || null,
          interview_kit_id: kitId || null,
        },
      });
      if (kind === "video" && res.meet_url) {
        if (res.calendar_pushed) {
          toast.success("Entrevista agendada e sincronizada com o Google Calendar");
        } else {
          toast.success(`Entrevista agendada. Sala: ${res.meet_url}`);
        }
      } else {
        toast.success("Entrevista agendada");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao agendar");
    } finally {
      setSaving(false);
    }
  };

  const handleSelfLink = async () => {
    const slots = slotsText
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d.toISOString();
      })
      .filter((s): s is string => s !== null);
    // Para entrevistas async, slots são opcionais (não há horário a escolher).
    if (kind !== "async" && slots.length === 0) {
      toast.error("Adicione ao menos um horário válido");
      return;
    }
    setSaving(true);
    try {
      const res = await createLink({
        data: {
          application_id: applicationId,
          interviewer_id: interviewer || null,
          kind,
          duration_min: duration,
          slots: slots.length > 0 ? slots : undefined,
          expires_in_days: 7,
          notes: notes || null,
          interview_kit_id: kitId || null,
        },
      });
      const url = `${getAppUrl()}/interview/${res.token}`;
      setGeneratedUrl(url);
      toast.success("Link de auto-agendamento criado");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar link");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Entrevista — {candidateName}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "manual" | "self")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="manual">Agendamento manual</TabsTrigger>
            <TabsTrigger value="self">Enviar link ao candidato</TabsTrigger>
          </TabsList>

          <div className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="onsite">Presencial</SelectItem>
                    <SelectItem value="async">Assíncrona</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Duração (min)</Label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 45)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Entrevistador</Label>
              <Select value={interviewer} onValueChange={setInterviewer}>
                <SelectTrigger>
                  <SelectValue placeholder="(eu)" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name ?? m.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>
                Kit de perguntas{" "}
                {kind === "async" ? "(obrigatório p/ vídeo assíncrono)" : "(opcional)"}
              </Label>
              <Select
                value={kitId || "__none"}
                onValueChange={(v) => setKitId(v === "__none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhum</SelectItem>
                  {kits.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {kits.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Crie kits em <span className="font-medium">ATS → Kits de Entrevista</span>.
                </p>
              )}
            </div>

            <TabsContent value="manual" className="space-y-3 m-0">
              <div className="space-y-1">
                <Label>Data e horário</Label>
                <Input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </div>
              {kind === "video" && (
                <div className="space-y-1">
                  <Label>Link da reunião (Meet/Zoom)</Label>
                  <Input
                    placeholder="https://meet.google.com/…"
                    value={meetUrl}
                    onChange={(e) => setMeetUrl(e.target.value)}
                  />
                </div>
              )}
              {kind === "onsite" && (
                <div className="space-y-1">
                  <Label>Endereço</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
              )}
              <div className="space-y-1">
                <Label>Anotações</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="self" className="space-y-3 m-0">
              <div className="space-y-1">
                <Label>Horários ofertados (um por linha, formato local)</Label>
                <Textarea
                  rows={5}
                  placeholder={"2026-06-30 14:00\n2026-06-30 15:00\n2026-07-01 10:00"}
                  value={slotsText}
                  onChange={(e) => setSlotsText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  O candidato recebe um link para escolher um destes horários (válido por 7 dias).
                </p>
              </div>
              {generatedUrl && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                  <div className="text-xs font-medium">Link gerado:</div>
                  <div className="text-xs break-all font-mono">{generatedUrl}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedUrl);
                      toast.success("Copiado");
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {tab === "manual" ? (
            <Button onClick={handleManual} disabled={saving}>
              {saving ? "Agendando…" : "Agendar"}
            </Button>
          ) : (
            <Button onClick={handleSelfLink} disabled={saving}>
              {saving ? "Gerando…" : generatedUrl ? "Gerar novo link" : "Gerar link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
