import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Play, Pause, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listCampaigns,
  upsertCampaign,
  deleteCampaign,
  setCampaignStatus,
  type Campaign,
} from "@/lib/prospecting-campaigns.functions";

export const Route = createFileRoute("/_authenticated/prospecting/campaigns/")({
  component: CampaignsListPage,
});

function CampaignsListPage() {
  const listFn = useServerFn(listCampaigns);
  const saveFn = useServerFn(upsertCampaign);
  const delFn = useServerFn(deleteCampaign);
  const statusFn = useServerFn(setCampaignStatus);

  const [rows, setRows] = useState<Campaign[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const refresh = async () => setRows(await listFn());
  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    try {
      const out = await saveFn({
        data: {
          name: name.trim(),
          assignment_mode: "weighted",
          max_attempts: 3,
          retry_interval_minutes: 240,
          source_type: "manual",
          source_ref: null,
          lead_ids: [],
          dialing_window: {
            start: "09:00",
            end: "18:00",
            timezone: "America/Sao_Paulo",
            days: [1, 2, 3, 4, 5],
          },
          variants: [],
        },
      });
      toast.success("Campanha criada");
      setOpen(false);
      setName("");
      await refresh();
      window.location.href = `/prospecting/campaigns/${out.id}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div>
      <PageHeader
        title="Campanhas de prospecção"
        description="Discagem automática com Vapi e A/B de scripts."
      />
      <div className="flex justify-end mb-3">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova campanha
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma campanha ainda.</p>
          )}
          <div className="divide-y">
            {rows.map((c) => (
              <div key={c.id} className="py-2 flex items-center justify-between gap-3">
                <Link
                  to="/prospecting/campaigns/$id"
                  params={{ id: c.id }}
                  className="flex-1 min-w-0"
                >
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.lead_ids?.length ?? 0} leads ·{" "}
                    {c.assignment_mode === "weighted" ? "A/B por peso" : "Por segmento"}
                  </div>
                </Link>
                <Badge
                  variant={
                    c.status === "running"
                      ? "default"
                      : c.status === "paused"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {c.status}
                </Badge>
                {c.status !== "running" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await statusFn({ data: { id: c.id, status: "running" } });
                      refresh();
                    }}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await statusFn({ data: { id: c.id, status: "paused" } });
                      refresh();
                    }}
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    if (await confirmDialog("Remover?")) {
                      await delFn({ data: { id: c.id } });
                      refresh();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova campanha</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={create}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
