import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Search, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listAtsJobs, saveAtsJob } from "@/lib/ats/ats.functions";
import { ATS_JOB_STATUSES } from "@/lib/ats/stages";

export const Route = createFileRoute("/_authenticated/jobs")({
  component: AtsJobsPage,
});

type JobRow = Awaited<ReturnType<typeof listAtsJobs>>[number];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ATS_JOB_STATUSES.map((s) => [s.value, s.label]),
);
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  published: "default",
  draft: "secondary",
  on_hold: "outline",
  filled: "outline",
  closed: "destructive",
};

function AtsJobsPage() {
  const list = useServerFn(listAtsJobs);
  const save = useServerFn(saveAtsJob);
  const navigate = useNavigate();
  const [rows, setRows] = useState<JobRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    seniority: "",
    employment_type: "clt",
    remote_mode: "hybrid",
    location: "",
    description: "",
    requirements: "",
    status: "draft",
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await list({ data: { search, status } });
      setRows(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao listar vagas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error("Informe o título da vaga");
      return;
    }
    try {
      const r = await save({
        data: {
          title: form.title.trim(),
          seniority: (form.seniority || null) as never,
          employment_type: form.employment_type as never,
          remote_mode: form.remote_mode as never,
          location: form.location || null,
          description: form.description || null,
          requirements: form.requirements || null,
          status: form.status as never,
        },
      });
      toast.success("Vaga criada");
      setOpen(false);
      setForm({
        title: "",
        seniority: "",
        employment_type: "clt",
        remote_mode: "hybrid",
        location: "",
        description: "",
        requirements: "",
        status: "draft",
      });
      if (r?.id) navigate({ to: "/ats/jobs/$id", params: { id: r.id as string } });
      else refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar vaga");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vaga…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refresh()}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {ATS_JOB_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Nova vaga
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova vaga</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Título *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex.: Desenvolvedor(a) Full Stack Pleno"
                />
              </div>
              <div>
                <Label>Senioridade</Label>
                <Select
                  value={form.seniority}
                  onValueChange={(v) => setForm({ ...form, seniority: v })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intern">Estágio</SelectItem>
                    <SelectItem value="junior">Júnior</SelectItem>
                    <SelectItem value="mid">Pleno</SelectItem>
                    <SelectItem value="senior">Sênior</SelectItem>
                    <SelectItem value="lead">Líder</SelectItem>
                    <SelectItem value="principal">Principal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vínculo</Label>
                <Select
                  value={form.employment_type}
                  onValueChange={(v) => setForm({ ...form, employment_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clt">CLT</SelectItem>
                    <SelectItem value="pj">PJ</SelectItem>
                    <SelectItem value="contract">Contrato</SelectItem>
                    <SelectItem value="internship">Estágio</SelectItem>
                    <SelectItem value="temporary">Temporário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modalidade</Label>
                <Select
                  value={form.remote_mode}
                  onValueChange={(v) => setForm({ ...form, remote_mode: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onsite">Presencial</SelectItem>
                    <SelectItem value="hybrid">Híbrido</SelectItem>
                    <SelectItem value="remote">Remoto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Localização</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Cidade, UF"
                />
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Requisitos</Label>
                <Textarea
                  rows={3}
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ATS_JOB_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Criar vaga</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground p-8 text-center">Carregando…</div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-3">
            <Briefcase className="h-10 w-10 mx-auto opacity-40" />
            <p>Nenhuma vaga ainda. Crie a primeira para começar o pipeline de seleção.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((j) => (
            <Link key={j.id} to="/jobs/$id" params={{ id: j.id }}>
              <Card className="hover:border-primary/40 transition-colors h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{j.title}</CardTitle>
                    <Badge variant={STATUS_VARIANT[j.status] ?? "secondary"}>
                      {STATUS_LABEL[j.status] ?? j.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <div className="flex flex-wrap gap-2">
                    {j.seniority && <Badge variant="outline">{j.seniority}</Badge>}
                    {j.remote_mode && <Badge variant="outline">{j.remote_mode}</Badge>}
                    {j.employment_type && <Badge variant="outline">{j.employment_type}</Badge>}
                  </div>
                  {j.location && <div>{j.location}</div>}
                  <div className="pt-2 flex items-center justify-between">
                    <span>{j.active_applications} candidato(s) ativo(s)</span>
                    {j.deal_id && <Badge variant="secondary">vinculada a negócio</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
