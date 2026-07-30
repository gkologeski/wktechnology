import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { useServerFn } from "@tanstack/react-start";
import { Video, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listMeetings } from "@/lib/meetings.functions";
import { MeetingDetailDrawer } from "@/components/meetings/meeting-detail-drawer";
import { StartVideoButton } from "@/components/meetings/start-video-button";
import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import { AssigneeCell } from "@/components/entity/assignee-cell";

export const Route = createFileRoute("/_authenticated/meetings")({
  component: MeetingsLibrary,
});

function MeetingsLibrary() {
  const list = useServerFn(listMeetings);
  const qc = useQueryClient();
  const { assignee, setAssignee, filterRows } = useAssigneeFilter();
  useRealtimeInvalidate([
    { table: "calendar_events", queryKeys: [["meetings"]] },
    { table: "meetings", queryKeys: [["meetings"]] },
  ]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "scheduled" | "live" | "ended" | "cancelled">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["meetings", "all", search, status],
    queryFn: () => list({ data: { search: search || undefined, status, limit: 100 } }),
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Video className="h-5 w-5" /> Reuniões
          </h1>
          <p className="text-sm text-muted-foreground">
            Biblioteca de reuniões com busca por título e transcrição.
          </p>
        </div>
        <StartVideoButton
          variant="default"
          size="default"
          onCreated={() => qc.invalidateQueries({ queryKey: ["meetings"] })}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título ou trecho da transcrição"
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="scheduled">Agendadas</SelectItem>
                <SelectItem value="live">Ao vivo</SelectItem>
                <SelectItem value="ended">Encerradas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>
            <AssigneeFilter value={assignee} onChange={setAssignee} className="w-[200px]" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.meetings?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma reunião encontrada.
            </p>
          ) : (
            <ul className="divide-y">
              {filterRows(data.meetings as any[]).map((m: any) => (
                <li key={m.id}>
                  <button
                    className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-muted/40 px-2 rounded"
                    onClick={() => setOpenId(m.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.title}</span>
                        <Badge variant={m.status === "live" ? "default" : "secondary"}>
                          {m.status}
                        </Badge>
                        {m.recording_storage_path && (
                          <Badge variant="outline" className="text-xs">
                            gravação
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(m.created_at)}
                      </div>
                    </div>
                    <AssigneeCell assignedTo={m.assigned_to} className="shrink-0 text-xs" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {openId && (
        <MeetingDetailDrawer meetingId={openId} open={!!openId} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
