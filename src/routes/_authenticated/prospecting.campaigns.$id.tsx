import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Save, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import {
  getCampaign, upsertCampaign, listCampaignAttempts, setCampaignStatus,
  type Campaign, type Variant, type Attempt,
} from "@/lib/prospecting-campaigns.functions";
import { listScripts, type ProspectingScript } from "@/lib/prospecting-scripts.functions";

export const Route = createFileRoute("/_authenticated/prospecting/campaigns/$id")({
  component: CampaignDetailPage,
});

type VariantForm = { script_id: string; weight: number; segment_id: string | null };

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getCampaign);
  const saveFn = useServerFn(upsertCampaign);
  const attemptsFn = useServerFn(listCampaignAttempts);
  const statusFn = useServerFn(setCampaignStatus);
  const scriptsFn = useServerFn(listScripts);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [variants, setVariants] = useState<VariantForm[]>([]);
  const [scripts, setScripts] = useState<ProspectingScript[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [leadIdsText, setLeadIdsText] = useState("");

  const refresh = async () => {
    const out = await getFn({ data: { id } });
    setCampaign(out.campaign);
    setVariants(out.variants.map((v: Variant) => ({ script_id: v.script_id, weight: v.weight, segment_id: v.segment_id })));
    setLeadIdsText((out.campaign.lead_ids ?? []).join("\n"));
    setAttempts(await attemptsFn({ data: { campaign_id: id } }));
  };
  useEffect(() => {
    refresh();
    scriptsFn().then(setScripts);
    /* eslint-disable-next-line */
  }, [id]);

  // Stats per variant — MUST be declared before any early return to keep hook order stable
  const stats = useMemo(() => {
    const byVariant: Record<string, { total: number; answered: number; success: number; durations: number[] }> = {};
    for (const a of attempts) {
      const key = a.variant_id ?? "none";
      const s = byVariant[key] ??= { total: 0, answered: 0, success: 0, durations: [] };
      s.total += 1;
      if (a.status === "completed") s.answered += 1;
      if (a.success_evaluation && a.success_evaluation.toLowerCase().includes("success")) s.success += 1;
      if (a.duration_seconds) s.durations.push(a.duration_seconds);
    }
    return byVariant;
  }, [attempts]);

  if (!campaign) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  const save = async () => {
    const leadIds = leadIdsText.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    try {
      await saveFn({ data: {
        id: campaign.id,
        name: campaign.name,
        assignment_mode: campaign.assignment_mode,
        max_attempts: campaign.max_attempts,
        retry_interval_minutes: campaign.retry_interval_minutes,
        source_type: "manual",
        source_ref: null,
        lead_ids: leadIds,
        dialing_window: campaign.dialing_window,
        variants: variants.filter((v) => v.script_id),
      }});
      toast.success("Salvo");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };


  const scriptName = (sid: string | null) => scripts.find((s) => s.id === sid)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/prospecting/campaigns"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <h2 className="text-lg font-semibold flex-1">{campaign.name}</h2>
        <Badge variant={campaign.status === "running" ? "default" : "outline"}>{campaign.status}</Badge>
        {campaign.status !== "running" ? (
          <Button size="sm" onClick={async () => {
            await save();
            await statusFn({ data: { id: campaign.id, status: "running" } });
            refresh();
          }}>
            <Play className="h-3.5 w-3.5 mr-1" />Salvar e iniciar
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={async () => { await statusFn({ data: { id: campaign.id, status: "paused" } }); refresh(); }}>
            <Pause className="h-3.5 w-3.5 mr-1" />Pausar
          </Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Configuração</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Nome</Label>
              <Input value={campaign.name} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} /></div>
            <div><Label>Modo de atribuição</Label>
              <Select value={campaign.assignment_mode} onValueChange={(v) => setCampaign({ ...campaign, assignment_mode: v as "weighted" | "segment" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weighted">A/B por peso</SelectItem>
                  <SelectItem value="segment">Por segmento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Máx. tentativas por lead</Label>
              <Input type="number" min={1} max={20} value={campaign.max_attempts}
                onChange={(e) => setCampaign({ ...campaign, max_attempts: parseInt(e.target.value, 10) || 3 })} /></div>
            <div><Label>Intervalo entre tentativas (min)</Label>
              <Input type="number" min={5} value={campaign.retry_interval_minutes}
                onChange={(e) => setCampaign({ ...campaign, retry_interval_minutes: parseInt(e.target.value, 10) || 240 })} /></div>
            <div><Label>Janela início</Label>
              <Input value={campaign.dialing_window.start} onChange={(e) => setCampaign({ ...campaign, dialing_window: { ...campaign.dialing_window, start: e.target.value } })} /></div>
            <div><Label>Janela fim</Label>
              <Input value={campaign.dialing_window.end} onChange={(e) => setCampaign({ ...campaign, dialing_window: { ...campaign.dialing_window, end: e.target.value } })} /></div>
          </div>

          <div>
            <Label>IDs de leads (um por linha)</Label>
            <Textarea rows={4} value={leadIdsText} onChange={(e) => setLeadIdsText(e.target.value)} placeholder="uuid de lead" />
            <p className="text-xs text-muted-foreground mt-1">Cole os UUIDs dos leads a serem chamados. Ao iniciar, cada lead vira uma chamada na fila.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Variantes (A/B)</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setVariants([...variants, { script_id: scripts[0]?.id ?? "", weight: 50, segment_id: null }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {variants.length === 0 && <p className="text-sm text-muted-foreground">Adicione ao menos um script.</p>}
          {variants.map((v, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Script</Label>
                <Select value={v.script_id} onValueChange={(val) => setVariants(variants.map((x, idx) => idx === i ? { ...x, script_id: val } : x))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {scripts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label>Peso</Label>
                <Input type="number" min={0} max={100} value={v.weight}
                  onChange={(e) => setVariants(variants.map((x, idx) => idx === i ? { ...x, weight: parseInt(e.target.value, 10) || 0 } : x))} />
              </div>
              <Button size="icon" variant="ghost" onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {campaign.assignment_mode === "weighted" && variants.length > 0 && (
            <p className="text-xs text-muted-foreground">Soma dos pesos: {variants.reduce((s, v) => s + v.weight, 0)}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}><Save className="h-4 w-4 mr-2" />Salvar</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Resultados por variante</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(stats).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem chamadas ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="text-left p-2">Variante</th><th className="text-right p-2">Chamadas</th><th className="text-right p-2">Atendidas</th><th className="text-right p-2">Sucesso</th><th className="text-right p-2">Duração média</th></tr>
              </thead>
              <tbody>
                {Object.entries(stats).map(([vid, s]) => {
                  const variant = vid === "none" ? null : variants[0]; // best-effort label
                  const avg = s.durations.length ? Math.round(s.durations.reduce((a, b) => a + b, 0) / s.durations.length) : 0;
                  const rate = s.total ? Math.round((s.answered / s.total) * 100) : 0;
                  const succ = s.total ? Math.round((s.success / s.total) * 100) : 0;
                  return (
                    <tr key={vid} className="border-t">
                      <td className="p-2">{vid === "none" ? "—" : scriptName(variant?.script_id ?? null)}</td>
                      <td className="p-2 text-right">{s.total}</td>
                      <td className="p-2 text-right">{s.answered} ({rate}%)</td>
                      <td className="p-2 text-right">{s.success} ({succ}%)</td>
                      <td className="p-2 text-right">{avg}s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Chamadas recentes</CardTitle></CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma chamada.</p>
          ) : (
            <div className="space-y-2">
              {attempts.slice(0, 50).map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b pb-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{scriptName(a.script_id)} · <span className="text-xs text-muted-foreground">{a.status}</span></div>
                    {a.summary && <div className="text-xs text-muted-foreground line-clamp-1">{a.summary}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground">{a.duration_seconds ?? 0}s</div>
                  {a.recording_url && <a className="text-xs text-primary underline ml-2" href={a.recording_url} target="_blank" rel="noreferrer">▶</a>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
