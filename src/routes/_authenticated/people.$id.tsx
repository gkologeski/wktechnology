import { EmploymentPanel } from "@/components/hiring/employment-panel";
import { usePersonResourceAccess } from "@/lib/access-control/use-person-resource-access";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { HrScreenAccess, HrRecordAccess, HrAccessError } from "@/components/hr-access";
import { useHrCapabilities } from "@/lib/access-control/use-hr-capabilities";
// /people/$id — ficha da pessoa (TechPeople).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { NotificationTargetNotice } from "@/components/notifications/notification-target-notice";
import { getNotificationDocumentTarget } from "@/lib/notifications/hr-targets.functions";
import { formatDateOnly } from "@/lib/crm";
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
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PersonOptionCombobox } from "@/components/people/person-option-combobox";
import { PersonRolePicker } from "@/components/people/person-role-picker";
import {
  EDUCATION_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  RELATIONSHIP_OPTIONS,
  SENIORITY_LABELS,
  SHIRT_SIZE_OPTIONS,
  nextSeniority,
  seniorityLabelFromProfile,
} from "@/lib/people/person-field-options";
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
import { PersonDocumentViewerDialog } from "@/components/people/document-viewer-dialog";
import { GoalsPanel } from "@/components/people/goals-panel";
import { OneOnOnesPanel } from "@/components/people/one-on-ones-panel";
import { ReviewsPanel } from "@/components/people/reviews-panel";
import { PsychosocialPanel } from "@/components/people/psychosocial-panel";
import { IncidentsPanel } from "@/components/people/incidents-panel";
import { AllocationsPanel } from "@/components/people/allocations-panel";
import { TimesheetPanel } from "@/components/people/timesheet-panel";
import { OnboardingPanel } from "@/components/people/onboarding-panel";
import { OffboardingCompliancePanel } from "@/components/people/offboarding-compliance-panel";
import { BenefitsPanel } from "@/components/people/benefits-panel";
import { confirmDialog } from "@/components/ui/confirm-dialog";

import { PhoneInput } from "@/components/ui/phone-input";
export const Route = createFileRoute("/_authenticated/people/$id")({
  validateSearch: (search: Record<string, unknown>): { tab?: string; documentId?: string } => ({
    tab: [
      "profile",
      "allocations",
      "timesheet",
      "goals",
      "one_on_ones",
      "reviews",
      "onboarding",
      "psychosocial",
      "incidents",
      "benefits",
      "documents",
      "timeline",
    ].includes(String(search.tab))
      ? String(search.tab)
      : "profile",
    documentId:
      typeof search.documentId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.documentId)
        ? search.documentId
        : undefined,
  }),
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
  const { user } = useAuth();
  const p = usePermissions();
  return (
    <HrScreenAccess resources={["techpeople.people"]}>
      <HrRecordAccess resource="people" id={id}>
        {user && p.workspaceId && (
          <PersonDetailPageContent
            key={`${user.id}:${p.workspaceId}:${id}:${[...p.permissions].sort().join("|")}`}
            userId={user.id}
            workspaceId={p.workspaceId}
          />
        )}
      </HrRecordAccess>
    </HrScreenAccess>
  );
}

function PersonDetailPageContent({ userId, workspaceId }: { userId: string; workspaceId: string }) {
  const { canAny } = usePermissions();
  const canView = (resource: string) =>
    canAny(["workspace", "team", "own"].map((scope) => `${resource}.view.${scope}`));
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getPerson);
  const upsertFn = useServerFn(upsertPerson);
  const listDocs = useServerFn(listPersonDocuments);
  const listTimeline = useServerFn(listPersonTimeline);
  const readDocument = useServerFn(getNotificationDocumentTarget);
  const { documentId, tab } = Route.useSearch();
  const focused = useQuery({
    queryKey: ["hr-notification-target", userId, workspaceId, "document", id, documentId],
    queryFn: () => readDocument({ data: { workspaceId, parentId: id, id: documentId! } }),
    enabled: !!documentId && tab === "documents" && canView("techpeople.documents"),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const focusedDocument =
    canView("techpeople.documents") &&
    focused.isFetchedAfterMount &&
    !focused.isFetching &&
    !focused.isError
      ? (focused.data ?? null)
      : null;

  const { data, isLoading, isError, refetch, isFetchedAfterMount, isFetching } = useQuery({
    queryKey: ["person", id, userId, workspaceId],
    queryFn: () => getFn({ data: { id } }),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const docs = useQuery({
    queryKey: ["person-docs", id, userId, workspaceId],
    queryFn: () => listDocs({ data: { person_id: id } }),
    enabled: !!data && isFetchedAfterMount && !isError && canView("techpeople.documents"),
    staleTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
  const documents =
    canView("techpeople.documents") && docs.isFetchedAfterMount && !docs.isFetching && !docs.isError
      ? (docs.data ?? []).filter(
          (document) => document.id !== documentId || focusedDocument?.id === documentId,
        )
      : [];

  const { data: timeline = [] } = useQuery({
    queryKey: ["person-timeline", id, userId, workspaceId],
    queryFn: () => listTimeline({ data: { person_id: id, limit: 50 } }),
    enabled: !!data && canView("techpeople.events"),
    staleTime: 30_000,
  });

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link to="/people">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Link>
      </Button>

      {isError ? (
        <HrAccessError retry={() => void refetch()} />
      ) : isLoading || !isFetchedAfterMount ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : data ? (
        <>
          <p role="status" hidden={!isFetching} className="text-sm text-muted-foreground">
            Conferindo acesso à pessoa…
          </p>
          <div hidden={isFetching} inert={isFetching || undefined}>
            <PersonForm
              key={`${userId}:${workspaceId}:${id}`}
              person={data}
              documents={documents}
              revalidating={isFetching || docs.isFetching}
              documentTarget={
                documentId
                  ? {
                      id: documentId,
                      pending: focused.isFetching || docs.isFetching,
                      failed: focused.isError || docs.isError || !canView("techpeople.documents"),
                      available: !!focusedDocument,
                      retry: () => {
                        if (canView("techpeople.documents")) {
                          void focused.refetch();
                          void docs.refetch();
                        }
                      },
                      metadata: focusedDocument,
                    }
                  : undefined
              }
              timeline={timeline}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["person", id] });
                qc.invalidateQueries({ queryKey: ["people"] });
                qc.invalidateQueries({ queryKey: ["person-timeline", id] });
                toast.success("Ficha atualizada");
              }}
              upsert={upsertFn}
            />
          </div>
        </>
      ) : (
        <p role="alert">Pessoa indisponível ou sem acesso.</p>
      )}
    </div>
  );
}

type PersonPayload = Awaited<ReturnType<typeof getPerson>>;
type DocumentTargetState = {
  id: string;
  pending: boolean;
  failed: boolean;
  available: boolean;
  retry: () => void;
  metadata: Awaited<ReturnType<typeof getNotificationDocumentTarget>> | null;
};

function PersonForm({
  person,
  documents,
  documentTarget,
  revalidating,
  timeline,
  onSaved,
  upsert,
}: {
  person: PersonPayload;
  documents: Awaited<ReturnType<typeof listPersonDocuments>>;
  documentTarget?: DocumentTargetState;
  revalidating: boolean;
  timeline: Awaited<ReturnType<typeof listPersonTimeline>>;
  onSaved: () => void;
  upsert: ReturnType<typeof useServerFn<typeof upsertPerson>>;
}) {
  const p = person;
  const { canAny } = usePermissions();
  const canViewResource = (resource: string) =>
    canAny(["workspace", "team", "own"].map((scope) => `${resource}.view.${scope}`));
  const access = useHrCapabilities("people", [p.id]);
  const canWrite = access.for(p.id).can_update;
  const canViewSensitive = !!person.can_view_sensitive;
  const canWriteSensitive = canWrite && person.can_update_sensitive === true;
  const { tab: requestedTab = "profile" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tabResource: Record<string, string> = {
    allocations: "techpeople.allocations",
    timesheet: "techpeople.timesheet",
    goals: "techpeople.goals",
    one_on_ones: "techpeople.one_on_ones",
    reviews: "techpeople.reviews",
    psychosocial: "techpeople.wellbeing.assessments",
    incidents: "techpeople.incidents",
    benefits: "techpeople.benefits",
    documents: "techpeople.documents",
    timeline: "techpeople.events",
  };
  const tabAllowed =
    requestedTab === "profile" ||
    (requestedTab === "onboarding"
      ? canViewResource("techpeople.onboarding") || canViewResource("techpeople.offboarding")
      : !!tabResource[requestedTab] && canViewResource(tabResource[requestedTab]));
  const selectedTab = tabAllowed ? requestedTab : "profile";

  const [fullName, setFullName] = useState(p.full_name);
  const [preferredName, setPreferredName] = useState(p.preferred_name ?? "");
  const [email, setEmail] = useState(p.email ?? "");
  const [phone, setPhone] = useState(p.phone ?? "");
  const [roleTitle, setRoleTitle] = useState(p.role_title ?? "");
  const [seniority, setSeniority] = useState(
    seniorityLabelFromProfile(p.seniority) ?? p.seniority ?? "",
  );
  const [location, setLocation] = useState(p.location ?? "");
  const [status, setStatus] = useState<PeopleStatus>(p.status);
  const [employment, setEmployment] = useState<PeopleEmploymentType>(p.employment_type);
  const [notes, setNotes] = useState(p.notes ?? "");
  const [costHour, setCostHour] = useState<string>(p.cost_hour != null ? String(p.cost_hour) : "");
  const [education, setEducation] = useState(p.education ?? "");
  const [shirtSize, setShirtSize] = useState(p.shirt_size ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(p.emergency_phone ?? "");
  const [emergencyRelationship, setEmergencyRelationship] = useState(
    p.emergency_relationship ?? "",
  );
  const [maritalStatus, setMaritalStatus] = useState(p.marital_status ?? "");
  const [spouseName, setSpouseName] = useState(p.spouse_name ?? "");
  const [bank, setBank] = useState(p.bank ?? "");
  const [bankAgency, setBankAgency] = useState(p.bank_agency ?? "");
  const [bankAccount, setBankAccount] = useState(p.bank_account ?? "");
  const [pixKey, setPixKey] = useState(p.pix_key ?? "");
  const [address, setAddress] = useState(p.address ?? "");
  const [cnpj, setCnpj] = useState(p.cnpj ?? "");
  const [legalEntityName, setLegalEntityName] = useState(p.legal_entity_name ?? "");
  const [tradeName, setTradeName] = useState(p.trade_name ?? "");
  const [simplesOptante, setSimplesOptante] = useState<"" | "yes" | "no">(
    p.simples_optante === true ? "yes" : p.simples_optante === false ? "no" : "",
  );

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
          ...(canWriteSensitive ? { cost_hour: costHour ? Number(costHour) : null } : {}),
          currency: "BRL",
          tags: p.tags ?? [],
          education: education || null,
          shirt_size: shirtSize || null,
          emergency_phone: emergencyPhone || null,
          emergency_relationship: emergencyRelationship || null,
          marital_status: maritalStatus || null,
          spouse_name: spouseName || null,
          ...(canWriteSensitive ? { bank: bank || null } : {}),
          ...(canWriteSensitive ? { bank_agency: bankAgency || null } : {}),
          ...(canWriteSensitive ? { bank_account: bankAccount || null } : {}),
          ...(canWriteSensitive ? { pix_key: pixKey || null } : {}),
          ...(canWriteSensitive ? { address: address || null } : {}),
          cnpj: cnpj || null,
          legal_entity_name: legalEntityName || null,
          trade_name: tradeName || null,
          simples_optante: simplesOptante === "yes" ? true : simplesOptante === "no" ? false : null,
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
          {(p as unknown as { manager_name?: string | null }).manager_name ? (
            <Badge variant="outline" className="gap-1">
              <UserCog className="h-3 w-3" />
              Gestor: {(p as unknown as { manager_name: string }).manager_name}
            </Badge>
          ) : p.manager_id ? null : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              Sem gestor · definir em Alocações
            </Badge>
          )}
        </div>
      </div>

      {!tabAllowed && (
        <p role="alert" className="text-sm text-muted-foreground">
          Você não tem permissão para consultar a aba solicitada pelo aviso.
        </p>
      )}
      <Tabs
        value={selectedTab}
        onValueChange={(value) =>
          void navigate({ to: ".", search: (previous) => ({ ...previous, tab: value }) })
        }
        className="min-w-0 w-full"
      >
        <TabsList className="h-auto max-w-full flex-wrap">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          {canViewResource("techpeople.allocations") && (
            <TabsTrigger value="allocations">Alocações</TabsTrigger>
          )}
          {canViewResource("techpeople.timesheet") && (
            <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
          )}
          {canViewResource("techpeople.goals") && <TabsTrigger value="goals">Metas</TabsTrigger>}
          {canViewResource("techpeople.one_on_ones") && (
            <TabsTrigger value="one_on_ones">1:1s</TabsTrigger>
          )}
          {canViewResource("techpeople.reviews") && (
            <TabsTrigger value="reviews">Avaliações</TabsTrigger>
          )}
          {(canViewResource("techpeople.onboarding") ||
            canViewResource("techpeople.offboarding")) && (
            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          )}
          {canViewResource("techpeople.wellbeing.assessments") ? (
            <TabsTrigger value="psychosocial">Psicossocial</TabsTrigger>
          ) : null}
          {canViewResource("techpeople.incidents") ? (
            <TabsTrigger value="incidents">Incidentes</TabsTrigger>
          ) : null}
          {canViewResource("techpeople.benefits") ? (
            <TabsTrigger value="benefits">Benefícios</TabsTrigger>
          ) : null}
          {canViewResource("techpeople.documents") && (
            <TabsTrigger value="documents">Documentos</TabsTrigger>
          )}
          {canViewResource("techpeople.events") && (
            <TabsTrigger value="timeline">Histórico</TabsTrigger>
          )}
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
                <PhoneInput
                  aria-label="Telefone"
                  value={phone}
                  disabled={!canWrite}
                  onChange={setPhone}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <PersonRolePicker
                  value={roleTitle}
                  disabled={!canWrite}
                  onChange={(name, sen) => {
                    setRoleTitle(name);
                    if (name) setSeniority((cur) => nextSeniority(cur, sen));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Senioridade</Label>
                <PersonOptionCombobox
                  label="Senioridade"
                  value={seniority}
                  options={SENIORITY_LABELS}
                  disabled={!canWrite}
                  onChange={setSeniority}
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
              <div className="space-y-2">
                <Label>Escolaridade</Label>
                <PersonOptionCombobox
                  label="Escolaridade"
                  value={education}
                  options={EDUCATION_OPTIONS}
                  disabled={!canWrite}
                  onChange={setEducation}
                />
              </div>
              <div className="space-y-2">
                <Label>Camiseta</Label>
                <PersonOptionCombobox
                  label="Camiseta"
                  value={shirtSize}
                  options={SHIRT_SIZE_OPTIONS}
                  disabled={!canWrite}
                  onChange={setShirtSize}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone de recado</Label>
                <PhoneInput
                  aria-label="Telefone de recado"
                  value={emergencyPhone}
                  disabled={!canWrite}
                  onChange={setEmergencyPhone}
                />
              </div>
              <div className="space-y-2">
                <Label>Parentesco do telefone de recado</Label>
                <PersonOptionCombobox
                  label="Parentesco do telefone de recado"
                  value={emergencyRelationship}
                  options={RELATIONSHIP_OPTIONS}
                  disabled={!canWrite}
                  onChange={setEmergencyRelationship}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado civil</Label>
                <PersonOptionCombobox
                  label="Estado civil"
                  value={maritalStatus}
                  options={MARITAL_STATUS_OPTIONS}
                  disabled={!canWrite}
                  onChange={setMaritalStatus}
                />
              </div>
              <div className="space-y-2">
                <Label>Cônjuge</Label>
                <Input
                  value={spouseName}
                  disabled={!canWrite}
                  onChange={(e) => setSpouseName(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados pessoa jurídica</CardTitle>
              <CardDescription>Informações da PJ do prestador, quando aplicável.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={cnpj}
                  disabled={!canWrite}
                  onChange={(e) => setCnpj(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Razão social</Label>
                <Input
                  value={legalEntityName}
                  disabled={!canWrite}
                  onChange={(e) => setLegalEntityName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome fantasia</Label>
                <Input
                  value={tradeName}
                  disabled={!canWrite}
                  onChange={(e) => setTradeName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Optante simples</Label>
                <Select
                  value={simplesOptante}
                  disabled={!canWrite}
                  onValueChange={(v) => setSimplesOptante(v as "" | "yes" | "no")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Sim</SelectItem>
                    <SelectItem value="no">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {canViewSensitive ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Financeiro (restrito)</CardTitle>
                <CardDescription>Visível apenas para gestores e administradores.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Custo/hora (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costHour}
                    disabled={!canWriteSensitive}
                    onChange={(e) => setCostHour(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input
                    value={bank}
                    disabled={!canWriteSensitive}
                    onChange={(e) => setBank(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Agência</Label>
                  <Input
                    value={bankAgency}
                    disabled={!canWriteSensitive}
                    onChange={(e) => setBankAgency(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Input
                    value={bankAccount}
                    disabled={!canWriteSensitive}
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PIX</Label>
                  <Input
                    value={pixKey}
                    disabled={!canWriteSensitive}
                    onChange={(e) => setPixKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    value={address}
                    disabled={!canWriteSensitive}
                    onChange={(e) => setAddress(e.target.value)}
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

        <TabsContent value="allocations" className="pt-4 space-y-4">
          <EmploymentPanel personId={p.id} />
          <HrScreenAccess resources={["techpeople.allocations"]}>
            <AllocationsPanel
              personId={p.id}
              personName={p.full_name}
              personDocs={[
                p.cnpj,
                (p.personal_doc as Record<string, unknown> | null)?.["cpf"] as
                  | string
                  | null
                  | undefined,
              ]}
              personCompanyNames={[p.legal_entity_name, p.trade_name]}
              canWrite={canWrite}
              canViewSensitive={canViewSensitive}
            />
          </HrScreenAccess>
        </TabsContent>

        <TabsContent value="timesheet" className="pt-4">
          <HrScreenAccess resources={["techpeople.timesheet"]}>
            <TimesheetPanel personId={p.id} />
          </HrScreenAccess>
        </TabsContent>

        <TabsContent value="goals" className="pt-4">
          <HrScreenAccess resources={["techpeople.goals"]}>
            <GoalsPanel personId={p.id} canWrite={canWrite} />
          </HrScreenAccess>
        </TabsContent>

        <TabsContent value="one_on_ones" className="pt-4">
          <HrScreenAccess resources={["techpeople.one_on_ones"]}>
            <OneOnOnesPanel personId={p.id} canWrite={canWrite} />
          </HrScreenAccess>
        </TabsContent>

        <TabsContent value="reviews" className="pt-4">
          <HrScreenAccess resources={["techpeople.reviews"]}>
            <ReviewsPanel personId={p.id} canWrite={canWrite} />
          </HrScreenAccess>
        </TabsContent>

        <TabsContent value="onboarding" className="pt-4 space-y-4">
          {p.status === "offboarding" || p.status === "terminated" ? (
            <OffboardingCompliancePanel personId={p.id} />
          ) : null}
          <HrScreenAccess resources={["techpeople.onboarding", "techpeople.offboarding"]}>
            <OnboardingPanel personId={p.id} />
          </HrScreenAccess>
        </TabsContent>

        {canViewResource("techpeople.wellbeing.assessments") ? (
          <TabsContent value="psychosocial" className="pt-4">
            <PsychosocialPanel personId={p.id} canWrite={canWrite} />
          </TabsContent>
        ) : null}

        {canViewResource("techpeople.incidents") ? (
          <TabsContent value="incidents" className="pt-4">
            <IncidentsPanel personId={p.id} canWrite={canWrite} />
          </TabsContent>
        ) : null}

        {canViewResource("techpeople.benefits") ? (
          <TabsContent value="benefits" className="pt-4">
            <BenefitsPanel personId={p.id} canWrite={canWrite} />
          </TabsContent>
        ) : null}

        {canViewResource("techpeople.documents") && (
          <TabsContent value="documents" className="space-y-4 pt-4">
            {documentTarget && (
              <NotificationTargetNotice
                label="Documento do aviso"
                targetId={documentTarget.id}
                loading={documentTarget.pending}
                failed={documentTarget.failed}
                available={documentTarget.available}
                retry={
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="outline"
                    onClick={documentTarget.retry}
                  >
                    Tentar novamente
                  </Button>
                }
              >
                {documentTarget.metadata && (
                  <>
                    <p>
                      {documentTarget.metadata.doc_type} · Validade:{" "}
                      {formatDateOnly(documentTarget.metadata.expires_at)}
                    </p>
                    <p className="text-muted-foreground">
                      Documento exato localizado. Abrir o aviso não baixa, publica, edita ou renova
                      o arquivo.
                    </p>
                  </>
                )}
              </NotificationTargetNotice>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Válidos" value={docStats.valid} tone="emerald" />
              <StatCard label="A vencer" value={docStats.expiring} tone="amber" />
              <StatCard label="Vencidos" value={docStats.expired} tone="rose" />
              <StatCard label="Ausentes" value={docStats.missing} tone="muted" />
            </div>
            <DocumentsPanel
              personId={p.id}
              documents={documents}
              documentTarget={documentTarget}
              revalidating={revalidating}
            />
          </TabsContent>
        )}

        {canViewResource("techpeople.events") && (
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
                          <div className="text-xs text-muted-foreground mt-1">{ev.description}</div>
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
        )}
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
        <div className={`text-2xl font-semibold ${toneClass} truncate`}>{value}</div>
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
  documentTarget,
  revalidating,
}: {
  personId: string;
  documents: PeopleDocumentRow[];
  documentTarget?: DocumentTargetState;
  revalidating: boolean;
}) {
  const qc = useQueryClient();
  const deleteFn = useServerFn(deletePersonDocument);
  const downloadFn = useServerFn(getDocumentDownloadUrl);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PeopleDocumentRow | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewing, setViewing] = useState<PeopleDocumentRow | null>(null);
  const rights = usePersonResourceAccess(
    "documents",
    personId,
    documents.map((document) => document.id),
  );
  const pending = revalidating || Boolean(documentTarget?.pending);
  useEffect(() => {
    if (!documentTarget || pending || (!documentTarget.failed && documentTarget.available)) return;
    if (editing?.id === documentTarget.id) {
      setOpen(false);
      setEditing(null);
    }
    if (viewing?.id === documentTarget.id) {
      setViewerOpen(false);
      setViewing(null);
    }
  }, [documentTarget, pending, editing?.id, viewing?.id]);

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

  function handleView(d: PeopleDocumentRow) {
    setViewing(d);
    setViewerOpen(true);
  }

  return (
    <>
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!rights.canCreate || rights.isError || pending}
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
              <div
                key={d.id}
                aria-current={d.id === documentTarget?.metadata?.id ? "true" : undefined}
                className={`p-4 flex flex-wrap items-center justify-between gap-3 ${d.id === documentTarget?.metadata?.id ? "bg-accent" : ""}`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{d.doc_type}</div>
                  {d.id === documentTarget?.metadata?.id && (
                    <Badge variant="outline">Documento do aviso</Badge>
                  )}
                  <div className="text-xs text-muted-foreground truncate">
                    {d.doc_number ?? "—"}
                    {d.expires_at ? ` · vence em ${formatDateOnly(d.expires_at)}` : ""}
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
                      onClick={() => handleView(d)}
                      title="Visualizar"
                      aria-label="Visualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {d.file_url ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(d.id)}
                      title="Baixar"
                      aria-label="Baixar"
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
                    aria-label="Editar"
                    disabled={!rights.canUpdate(d.id) || rights.isError || pending}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (await confirmDialog(`Remover documento "${d.doc_type}"?`))
                        del.mutate(d.id);
                    }}
                    title="Remover"
                    aria-label="Remover"
                    disabled={!rights.canDelete(d.id) || rights.isError || pending}
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
        revalidating={pending}
        writable={!rights.isError && (editing ? rights.canUpdate(editing.id) : rights.canCreate)}
      />
      <PersonDocumentViewerDialog
        open={viewerOpen && !pending}
        onOpenChange={setViewerOpen}
        document={viewing}
      />
    </>
  );
}
