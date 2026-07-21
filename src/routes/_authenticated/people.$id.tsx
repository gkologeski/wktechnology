// /people/$id — ficha da pessoa (TechPeople).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  UserCog,
  FileCheck2,
  Clock,
  Plus,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPerson,
  upsertPerson,
  PEOPLE_STATUSES,
  PEOPLE_STATUS_LABELS,
  PEOPLE_EMPLOYMENT_TYPES,
  PEOPLE_EMPLOYMENT_LABELS,
  type PeopleStatus,
  type PeopleEmploymentType,
} from "@/lib/people/people.functions";
import {
  listPersonDocuments,
  listPersonTimeline,
  deletePersonDocument,
  getDocumentDownloadUrl,
  type PeopleDocumentRow,
} from "@/lib/people/documents.functions";
import { PersonDocumentDialog } from "@/components/people/document-dialog";

export const Route = createFileRoute("/_authenticated/people/$id")({
  head: () => ({
    meta: [
      { title: "Ficha da pessoa · TechPeople" },
      {
        name: "description",
        content: "Ficha 360° da pessoa: dados, documentos, alocações e histórico.",
      },
    ],
  }),
  component: PersonDetailPage,
});

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function PersonDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getPerson);
  const upsertFn = useServerFn(upsertPerson);
  const listDocs = useServerFn(listPersonDocuments);
  const listTimeline = useServerFn(listPersonTimeline);

  const { data, isLoading } = useQuery({
    queryKey: ["person", id],
    queryFn: () => getFn({ data: { id } }),
    staleTime: 15_000,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["person-docs", id],
    queryFn: () => listDocs({ data: { person_id: id } }),
    enabled: !!data,
    staleTime: 30_000,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["person-timeline", id],
    queryFn: () => listTimeline({ data: { person_id: id, limit: 50 } }),
    enabled: !!data,
    staleTime: 30_000,
  });

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link to="/people">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Link>
      </Button>

      {isLoading || !data ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <PersonForm
          person={data}
          documents={documents}
          timeline={timeline}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["person", id] });
            qc.invalidateQueries({ queryKey: ["people"] });
            qc.invalidateQueries({ queryKey: ["person-timeline", id] });
            toast.success("Ficha atualizada");
          }}
          upsert={upsertFn}
        />
      )}
    </div>
  );
}

type PersonPayload = Awaited<ReturnType<typeof getPerson>>;

function PersonForm({
  person,
  documents,
  timeline,
  onSaved,
  upsert,
}: {
  person: PersonPayload;
  documents: Awaited<ReturnType<typeof listPersonDocuments>>;
  timeline: Awaited<ReturnType<typeof listPersonTimeline>>;
  onSaved: () => void;
  upsert: ReturnType<typeof useServerFn<typeof upsertPerson>>;
}) {
  const p = person;
  const canWrite = true; // RLS bloqueia writes de não-admins — botão aparece, servidor decide.
  const canViewSensitive = person.can_view_sensitive;

  const [fullName, setFullName] = useState(p.full_name);
  const [preferredName, setPreferredName] = useState(p.preferred_name ?? "");
  const [email, setEmail] = useState(p.email ?? "");
  const [phone, setPhone] = useState(p.phone ?? "");
  const [roleTitle, setRoleTitle] = useState(p.role_title ?? "");
  const [seniority, setSeniority] = useState(p.seniority ?? "");
  const [location, setLocation] = useState(p.location ?? "");
  const [status, setStatus] = useState<PeopleStatus>(p.status);
  const [employment, setEmployment] = useState<PeopleEmploymentType>(p.employment_type);
  const [notes, setNotes] = useState(p.notes ?? "");
  const [costHour, setCostHour] = useState<string>(p.cost_hour != null ? String(p.cost_hour) : "");

  const mut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: p.id,
          full_name: fullName,
          preferred_name: preferredName || null,
          email: email || null,
          phone: phone || null,
          role_title: roleTitle || null,
          seniority: seniority || null,
          location: location || null,
          status,
          employment_type: employment,
          notes: notes || null,
          cost_hour: costHour ? Number(costHour) : null,
          currency: "BRL",
          tags: p.tags ?? [],
        },
      }),
    onSuccess: onSaved,
    onError: (e: Error) => toast.error(e.message),
  });

  const docStats = useMemo(() => {
    const stats = { valid: 0, expiring: 0, expired: 0, missing: 0 };
    for (const d of documents) stats[d.status] = (stats[d.status] ?? 0) + 1;
    return stats;
  }, [documents]);

  return (
    <>
      <PageHeader
        title={p.full_name}
        description={p.role_title ?? "—"}
        actions={
          canWrite ? (
            <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={p.photo_url ?? undefined} />
          <AvatarFallback>{initials(p.full_name)}</AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{PEOPLE_EMPLOYMENT_LABELS[p.employment_type]}</Badge>
          <Badge variant="secondary">{PEOPLE_STATUS_LABELS[p.status]}</Badge>
          {p.hire_date ? (
            <Badge variant="outline" className="gap-1">
              <UserCog className="h-3 w-3" /> Desde {p.hire_date}
            </Badge>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="timeline">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados básicos</CardTitle>
              <CardDescription>Informações públicas para o time.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input
                  value={fullName}
                  disabled={!canWrite}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Como prefere ser chamado</Label>
                <Input
                  value={preferredName}
                  disabled={!canWrite}
                  onChange={(e) => setPreferredName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  disabled={!canWrite}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={phone}
                  disabled={!canWrite}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input
                  value={roleTitle}
                  disabled={!canWrite}
                  onChange={(e) => setRoleTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Senioridade</Label>
                <Input
                  value={seniority}
                  disabled={!canWrite}
                  onChange={(e) => setSeniority(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Localização</Label>
                <Input
                  value={location}
                  disabled={!canWrite}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vínculo</Label>
                <Select
                  value={employment}
                  disabled={!canWrite}
                  onValueChange={(v) => setEmployment(v as PeopleEmploymentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PEOPLE_EMPLOYMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {PEOPLE_EMPLOYMENT_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  disabled={!canWrite}
                  onValueChange={(v) => setStatus(v as PeopleStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PEOPLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PEOPLE_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {canViewSensitive ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Financeiro (restrito)</CardTitle>
                <CardDescription>
                  Visível apenas para gestores e administradores.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Custo/hora (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costHour}
                    disabled={!canWrite}
                    onChange={(e) => setCostHour(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas internas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                disabled={!canWrite}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Válidos" value={docStats.valid} tone="emerald" />
            <StatCard label="A vencer" value={docStats.expiring} tone="amber" />
            <StatCard label="Vencidos" value={docStats.expired} tone="rose" />
            <StatCard label="Ausentes" value={docStats.missing} tone="muted" />
          </div>
          <DocumentsPanel personId={p.id} documents={documents} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-3 pt-4">
          {timeline.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              <Clock className="h-6 w-6 mx-auto mb-2 opacity-60" />
              Nenhum evento registrado ainda.
            </div>
          ) : (
            timeline.map((ev) => (
              <Card key={ev.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{ev.title}</div>
                      {ev.description ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          {ev.description}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "muted";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "rose"
          ? "text-rose-600"
          : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function docBadgeClass(status: PeopleDocumentRow["status"]) {
  switch (status) {
    case "valid":
      return "bg-emerald-500/10 text-emerald-700";
    case "expiring":
      return "bg-amber-500/10 text-amber-700";
    case "expired":
      return "bg-rose-500/10 text-rose-700";
    default:
      return "";
  }
}

function DocumentsPanel({
  personId,
  documents,
}: {
  personId: string;
  documents: PeopleDocumentRow[];
}) {
  const qc = useQueryClient();
  const deleteFn = useServerFn(deletePersonDocument);
  const downloadFn = useServerFn(getDocumentDownloadUrl);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PeopleDocumentRow | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-docs", personId] });
      toast.success("Documento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDownload(id: string) {
    try {
      const { url } = await downloadFn({ data: { id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar link");
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> Novo documento
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 divide-y">
          {documents.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              <FileCheck2 className="h-6 w-6 mx-auto mb-2 opacity-60" />
              Nenhum documento cadastrado.
            </div>
          ) : (
            documents.map((d) => (
              <div key={d.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{d.doc_type}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {d.doc_number ?? "—"}
                    {d.expires_at ? ` · vence em ${d.expires_at}` : ""}
                    {d.file_name ? ` · ${d.file_name}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className={docBadgeClass(d.status)}>
                    {d.status}
                  </Badge>
                  {d.file_url ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(d.id)}
                      title="Baixar"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(d);
                      setOpen(true);
                    }}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Remover documento "${d.doc_type}"?`)) del.mutate(d.id);
                    }}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <PersonDocumentDialog
        open={open}
        onOpenChange={setOpen}
        personId={personId}
        document={editing}
      />
    </>
  );
}
