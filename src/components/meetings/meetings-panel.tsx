import { formatDateTime } from "@/lib/crm";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Video, Calendar, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listMeetings, deleteMeeting } from "@/lib/meetings.functions";
import { MeetingDetailDrawer } from "./meeting-detail-drawer";
import { StartVideoButton } from "./start-video-button";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";

interface Props {
  entity: "contact" | "lead" | "deal" | "ticket";
  entityId: string;
}

export function MeetingsPanel({ entity, entityId }: Props) {
  const list = useServerFn(listMeetings);
  const del = useServerFn(deleteMeeting);
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["meetings", entity, entityId],
    queryFn: () => list({ data: { entity, entity_id: entityId, status: "all", limit: 25 } }),
  });

  async function remove(id: string) {
    if (!(await confirmDialog("Excluir esta reunião e sua gravação?"))) return;
    try {
      await del({ data: { id } });
      toast.success("Reunião excluída");
      qc.invalidateQueries({ queryKey: ["meetings", entity, entityId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="h-4 w-4" />
          Reuniões
        </CardTitle>
        <StartVideoButton
          entity={entity}
          entityId={entityId}
          onCreated={() => qc.invalidateQueries({ queryKey: ["meetings", entity, entityId] })}
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.meetings?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma reunião ainda.</p>
        ) : (
          <ul className="space-y-2">
            {data.meetings.map((m: any) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/40"
              >
                <button className="flex-1 text-left" onClick={() => setOpenId(m.id)}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.title}</span>
                    <Badge variant={m.status === "live" ? "default" : "secondary"}>
                      {m.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDateTime(m.created_at)}
                    {m.recording_storage_path ? " · gravação anexada" : ""}
                  </div>
                </button>
                <Button variant="ghost" size="icon" onClick={() => remove(m.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {openId && (
        <MeetingDetailDrawer meetingId={openId} open={!!openId} onClose={() => setOpenId(null)} />
      )}
    </Card>
  );
}
