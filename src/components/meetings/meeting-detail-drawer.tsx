import { getPublicAppUrl } from "@/lib/app-url";
import { formatDateTime } from "@/lib/crm";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Sparkles, ListChecks, Video, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  getMeeting,
  createRecordingUploadUrl,
  attachRecording,
  generateMeetingSummary,
  createTasksFromActionItems,
} from "@/lib/meetings.functions";

interface Props {
  meetingId: string;
  open: boolean;
  onClose: () => void;
}

export function MeetingDetailDrawer({ meetingId, open, onClose }: Props) {
  const get = useServerFn(getMeeting);
  const createUpload = useServerFn(createRecordingUploadUrl);
  const attach = useServerFn(attachRecording);
  const summarize = useServerFn(generateMeetingSummary);
  const mkTasks = useServerFn(createTasksFromActionItems);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: () => get({ data: { id: meetingId } }),
    enabled: open,
  });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { uploadUrl, path } = await createUpload({
        data: { meeting_id: meetingId, filename: file.name },
      });
      const up = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!up.ok) throw new Error(`Upload falhou: ${up.status}`);
      await attach({
        data: {
          meeting_id: meetingId,
          path,
          mime_type: file.type,
        },
      });
      toast.success("Gravação anexada");
      await refetch();
      qc.invalidateQueries({ queryKey: ["meetings"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao enviar gravação");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runSummary() {
    setSummarizing(true);
    try {
      await summarize({ data: { meeting_id: meetingId } });
      toast.success("Resumo gerado");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na transcrição");
    } finally {
      setSummarizing(false);
    }
  }

  async function makeTasks() {
    setCreatingTasks(true);
    try {
      const { created } = await mkTasks({ data: { meeting_id: meetingId } });
      toast.success(`${created} tarefa(s) criada(s)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar tarefas");
    } finally {
      setCreatingTasks(false);
    }
  }

  function copyLink() {
    if (!data?.meeting) return;
    const origin = getPublicAppUrl();
    navigator.clipboard.writeText(`${origin}/meet/${data.meeting.public_token}`);
    toast.success("Link público copiado");
  }

  function openHostRoom() {
    if (!data?.meeting) return;
    const url = `https://meet.jit.si/${data.meeting.room_name}#userInfo.displayName=%22Host%22`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const meeting = data?.meeting as any;
  const summary = data?.summary as any;
  const actionItems: any[] = Array.isArray(summary?.action_items) ? summary.action_items : [];
  const decisions: any[] = Array.isArray(summary?.decisions) ? summary.decisions : [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{meeting?.title ?? "Reunião"}</SheetTitle>
        </SheetHeader>

        {isLoading || !meeting ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant={meeting.status === "live" ? "default" : "secondary"}>
                {meeting.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Criada em {formatDateTime(meeting.created_at)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={openHostRoom}>
                <Video className="mr-2 h-4 w-4" />
                Abrir sala
              </Button>
              <Button size="sm" variant="outline" onClick={copyLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar link público
              </Button>
            </div>

            {/* Recording */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Gravação</h3>
              {data?.recordingUrl ? (
                <audio controls src={data.recordingUrl} className="w-full" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma gravação anexada. Envie o arquivo gerado pelo Jitsi para destravar
                  transcrição e resumo automáticos.
                </p>
              )}
              <input ref={fileRef} type="file" accept="audio/*,video/*" hidden onChange={onPick} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {data?.recordingUrl ? "Substituir gravação" : "Enviar gravação"}
              </Button>
            </section>

            {/* Summary */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Resumo & transcrição</h3>
                {data?.recordingUrl && (
                  <Button size="sm" variant="outline" onClick={runSummary} disabled={summarizing}>
                    {summarizing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {summary?.status === "completed" ? "Regerar" : "Gerar com IA"}
                  </Button>
                )}
              </div>

              {summary?.status === "processing" && (
                <p className="text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-3 w-3 animate-spin" />
                  Processando…
                </p>
              )}
              {summary?.status === "failed" && (
                <p className="text-sm text-destructive">Falhou: {summary.error_message}</p>
              )}
              {summary?.summary && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {summary.summary}
                </div>
              )}

              {decisions.length > 0 && (
                <div>
                  <h4 className="mt-3 mb-1 text-xs font-semibold text-muted-foreground">
                    Decisões
                  </h4>
                  <ul className="list-disc pl-5 text-sm">
                    {decisions.map((d, i) => (
                      <li key={i}>{typeof d === "string" ? d : JSON.stringify(d)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {actionItems.length > 0 && (
                <div>
                  <div className="mt-3 mb-1 flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-muted-foreground">Action items</h4>
                    <Button size="sm" variant="ghost" onClick={makeTasks} disabled={creatingTasks}>
                      {creatingTasks ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <ListChecks className="mr-2 h-3 w-3" />
                      )}
                      Criar tarefas
                    </Button>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {actionItems.map((it, i) => (
                      <li key={i} className="rounded border p-2">
                        <div className="font-medium">{it?.task ?? "—"}</div>
                        {(it?.assignee || it?.due_hint) && (
                          <div className="text-xs text-muted-foreground">
                            {it?.assignee ? `Responsável: ${it.assignee}` : null}
                            {it?.assignee && it?.due_hint ? " · " : null}
                            {it?.due_hint ? `Prazo: ${it.due_hint}` : null}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary?.transcript && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                    Ver transcrição completa
                  </summary>
                  <pre className="mt-2 max-h-80 overflow-y-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap">
                    {summary.transcript}
                  </pre>
                </details>
              )}
            </section>

            {/* Participants */}
            {data?.participants && data.participants.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Participantes</h3>
                <ul className="space-y-1 text-sm">
                  {data.participants.map((p: any) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <span>{p.display_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(p.joined_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
