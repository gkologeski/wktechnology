import { formatDateTime } from "@/lib/crm";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles,
  RefreshCw,
  Trash2,
  Phone,
  MessageSquare,
  Mail,
  Video,
  FileText,
  ListTodo,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { generateAiSummary, listAiSummaries, deleteAiSummary } from "@/lib/ai-summaries.functions";

type Entity = "lead" | "contact" | "deal" | "ticket";
type Kind = "conversation" | "call" | "meeting" | "email" | "notes" | "tasks" | "all";

type SummaryRow = {
  id: string;
  kind: Kind;
  summary: string;
  key_points: string[];
  next_actions: string[];
  sentiment: string | null;
  model: string | null;
  window_from: string | null;
  window_to: string | null;
  source_count: number;
  created_at: string;
};

const SENTIMENT_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  positivo: "default",
  neutro: "secondary",
  negativo: "destructive",
};

const KIND_OPTIONS: { value: Kind; label: string; icon: ReactNode }[] = [
  { value: "conversation", label: "Conversa", icon: <MessageSquare className="h-3 w-3" /> },
  { value: "call", label: "Ligações", icon: <Phone className="h-3 w-3" /> },
  { value: "meeting", label: "Reuniões", icon: <Video className="h-3 w-3" /> },
  { value: "email", label: "E-mails", icon: <Mail className="h-3 w-3" /> },
  { value: "notes", label: "Notas", icon: <FileText className="h-3 w-3" /> },
  { value: "tasks", label: "Tarefas", icon: <ListTodo className="h-3 w-3" /> },
  { value: "all", label: "Tudo", icon: <Layers className="h-3 w-3" /> },
];

const KIND_LABEL: Record<Kind, string> = KIND_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<Kind, string>,
);

export function AiSummaryPanel({ entity, entityId }: { entity: Entity; entityId: string }) {
  const list = useServerFn(listAiSummaries);
  const gen = useServerFn(generateAiSummary);
  const del = useServerFn(deleteAiSummary);

  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [kind, setKind] = useState<Kind>("conversation");
  const [windowDays, setWindowDays] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await list({
        data: { entity, entity_id: entityId, limit: 10 },
      })) as SummaryRow[];
      setRows(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [entity, entityId, list]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = (await gen({
        data: { entity, entity_id: entityId, kind, window_days: windowDays },
      })) as { skipped?: boolean; reason?: string } | undefined;
      if (res && res.skipped) {
        toast.info(res.reason ?? "Sem dados suficientes para resumir.");
      } else {
        toast.success("Resumo gerado");
        await load();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este resumo?")) return;
    try {
      await del({ data: { id } });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Resumo IA
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    {opt.icon}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v))}>
            <SelectTrigger className="h-8 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="180">180 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={generate} disabled={generating}>
            {generating ? (
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            Gerar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-xs text-muted-foreground">Carregando…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum resumo ainda. Clique em <strong>Gerar</strong> para criar um resumo automático
            das interações.
          </p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {r.kind === "call" ? "Calls" : "Conversa"}
                </Badge>
                {r.sentiment && (
                  <Badge
                    variant={SENTIMENT_VARIANT[r.sentiment] ?? "outline"}
                    className="text-[10px]"
                  >
                    {r.sentiment}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {r.source_count} msg · {formatDateTime(r.created_at)}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(r.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-sm whitespace-pre-wrap">{r.summary}</p>
            {r.key_points.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Pontos-chave</p>
                <ul className="list-disc pl-4 space-y-0.5 text-xs">
                  {r.key_points.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.next_actions.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">
                  Próximos passos
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-xs">
                  {r.next_actions.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
