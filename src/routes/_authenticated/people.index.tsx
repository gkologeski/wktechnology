// /people — lista de pessoas (TechPeople).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Search, UserCog, ClipboardList, BarChart3 } from "lucide-react";

import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useGridSelection } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  listPeople,
  upsertPerson,
  PEOPLE_STATUSES,
  PEOPLE_STATUS_LABELS,
  PEOPLE_EMPLOYMENT_TYPES,
  PEOPLE_EMPLOYMENT_LABELS,
  type PeopleStatus,
  type PeopleEmploymentType,
} from "@/lib/people/people.functions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ViewModeToggle } from "@/components/kanban/view-mode-toggle";

export const Route = createFileRoute("/_authenticated/people/")({
  validateSearch: (search: Record<string, unknown>): { view?: "table" | "kanban" } => ({
    view: search.view === "kanban" ? "kanban" : "table",
  }),
  head: () => ({
    meta: [
      { title: "Pessoas · TechPeople" },
      {
        name: "description",
        content: "Gestão 360° de prestadores e time interno — TechPeople.",
      },
      { property: "og:title", content: "Pessoas · TechPeople" },
      {
        property: "og:description",
        content: "Cadastro, alocação, resultados e saúde do time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeoplePage,
});

const STATUS_TONE: Record<PeopleStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  bench: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  on_leave: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  offboarding: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  terminated: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

// Tokens de cor para o "dot" das colunas do kanban.
const KANBAN_TONE: Record<PeopleStatus, string> = {
  active: "bg-emerald-500",
  bench: "bg-amber-500",
  on_leave: "bg-blue-500",
  offboarding: "bg-orange-500",
  terminated: "bg-rose-500",
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function PeoplePage() {
  const qc = useQueryClient();
  const list = useServerFn(listPeople);
  const upsertFn = useServerFn(upsertPerson);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const { assignee, setAssignee, filterRows } = useAssigneeFilter();

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["people", { search, status }],
    queryFn: () =>
      list({
        data: {
          search: search.length >= 2 ? search : undefined,
          status: status === "all" ? null : (status as PeopleStatus),
        },
      }),
    staleTime: 20_000,
  });

  const rows = filterRows(allRows);

  // Seleção múltipla / ações em massa (padrão de grids).
  const { canAny } = usePermissions();
  const selection = useGridSelection(rows as Array<(typeof rows)[number] & { id: string }>);
  const selectAllFiltered = () => selection.setSelectedIds(new Set(rows.map((r) => r.id)));

  const view = Route.useSearch().view ?? "table";
  const navigate = Route.useNavigate();
  const setView = (v: "table" | "kanban") =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, view: v }) });
  const canUpdatePerson = canAny([
    "techpeople.people.update.workspace",
    "techpeople.people.update.team",
    "techpeople.people.update.own",
  ]);

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Pessoas"
        description="Gerencie prestadores, ex-candidatos contratados e o time interno."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/people/analytics">
                <BarChart3 className="h-4 w-4 mr-2" /> Analytics
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/people/onboarding-templates">
                <ClipboardList className="h-4 w-4 mr-2" /> Modelos
              </Link>
            </Button>
            <Button onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova pessoa
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {PEOPLE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PEOPLE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AssigneeFilter value={assignee} onChange={setAssignee} className="w-full sm:w-56" />
        <ViewModeToggle value={view} onChange={setView} />
      </div>

      {view === "table" && selection.hasSelection && (
        <GridBulkBar
          table="people"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="pessoa(s)"
          onClear={selection.clear}
          onDone={() => void qc.invalidateQueries({ queryKey: ["people"] })}
          totalMatching={rows.length}
          onSelectAll={selectAllFiltered}
          canUpdate={canAny([
            "techpeople.people.update.workspace",
            "techpeople.people.update.team",
            "techpeople.people.update.own",
          ])}
          canDelete={canAny(["techpeople.people.delete.workspace", "techpeople.people.delete.own"])}
          bulkEditFields={[
            {
              name: "status",
              label: "Status",
              type: "select",
              options: PEOPLE_STATUSES.map((s) => ({ value: s, label: PEOPLE_STATUS_LABELS[s] })),
            },
            {
              name: "employment_type",
              label: "Vínculo",
              type: "select",
              options: PEOPLE_EMPLOYMENT_TYPES.map((t) => ({
                value: t,
                label: PEOPLE_EMPLOYMENT_LABELS[t],
              })),
            },
            { name: "role_title", label: "Cargo / posição", type: "text" },
            { name: "seniority", label: "Senioridade", type: "text" },
            { name: "location", label: "Localização", type: "text" },
          ]}
        />
      )}

      {view === "kanban" ? (
        <KanbanBoard
          rows={rows as Array<(typeof rows)[number] & { id: string }>}
          table="people"
          stageField="status"
          selectable
          entityLabel="pessoa"
          canDelete={canAny(["techpeople.people.delete.workspace","techpeople.people.delete.own"])}
          canUpdate={canUpdatePerson}
          isLoading={isLoading}
          invalidateKeys={[["people"]]}
          ariaLabel="Quadro de pessoas"
          columns={PEOPLE_STATUSES.map((s) => ({
            value: s,
            label: PEOPLE_STATUS_LABELS[s],
            tone: KANBAN_TONE[s],
          }))}
          emptyState={
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <UserCog className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm font-medium">Nenhuma pessoa cadastrada</div>
            </div>
          }
          renderCard={(p) => (
            <div className="space-y-2 pr-6">
              <Link
                to="/people/$id"
                params={{ id: p.id }}
                className="flex items-center gap-2 hover:underline"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={p.photo_url ?? undefined} alt={p.full_name} />
                  <AvatarFallback className="text-[10px]">
                    {initials(p.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium leading-snug">{p.full_name}</span>
              </Link>
              <p className="text-xs text-muted-foreground">
                {p.role_title ?? "Sem cargo definido"}
              </p>
              <div className="flex items-center justify-between">
                <Badge variant="outline">{PEOPLE_EMPLOYMENT_LABELS[p.employment_type]}</Badge>
                <AssigneeCell assignedTo={p.assigned_to} />
              </div>
            </div>
          )}
        />
      ) : (
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Selecionar todas as pessoas exibidas"
                  checked={
                    selection.allOnPageSelected
                      ? true
                      : selection.someOnPageSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={selection.toggleAllOnPage}
                />
              </TableHead>
              <TableHead>Pessoa</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Vínculo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contratação</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <UserCog className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Nenhuma pessoa cadastrada</div>
                      <div className="text-xs text-muted-foreground">
                        Cadastre um prestador ou promova um candidato contratado.
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setOpenNew(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Nova pessoa
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Checkbox
                      aria-label={`Selecionar ${p.full_name}`}
                      checked={selection.selectedIds.has(p.id)}
                      onCheckedChange={() => selection.toggleOne(p.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/people/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={p.photo_url ?? undefined} alt={p.full_name} />
                        <AvatarFallback className="text-xs">{initials(p.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.full_name}</span>
                        {p.email ? (
                          <span className="text-xs text-muted-foreground">{p.email}</span>
                        ) : null}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{p.role_title ?? "—"}</div>
                    {p.seniority ? (
                      <div className="text-xs text-muted-foreground">{p.seniority}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{PEOPLE_EMPLOYMENT_LABELS[p.employment_type]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_TONE[p.status]} variant="secondary">
                      {PEOPLE_STATUS_LABELS[p.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.hire_date ?? "—"}
                  </TableCell>
                  <TableCell>
                    <AssigneeCell assignedTo={p.assigned_to} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/people/$id" params={{ id: p.id }}>
                        Abrir
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      )}

      <NewPersonDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["people"] });
          toast.success("Pessoa cadastrada");
        }}
        upsert={upsertFn}
      />
    </div>
  );
}

function NewPersonDialog({
  open,
  onOpenChange,
  onSaved,
  upsert,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  upsert: ReturnType<typeof useServerFn<typeof upsertPerson>>;
}) {
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [seniority, setSeniority] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [hireDate, setHireDate] = useState("");
  const [employment, setEmployment] = useState<PeopleEmploymentType>("pj");
  const [status, setStatus] = useState<PeopleStatus>("active");
  const [legalEntity, setLegalEntity] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [costHour, setCostHour] = useState("");
  const [monthlyCost, setMonthlyCost] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setFullName("");
    setPreferredName("");
    setEmail("");
    setPhone("");
    setRole("");
    setSeniority("");
    setLocation("");
    setTimezone("America/Sao_Paulo");
    setHireDate("");
    setEmployment("pj");
    setStatus("active");
    setLegalEntity("");
    setCnpj("");
    setCostHour("");
    setMonthlyCost("");
    setCurrency("BRL");
    setTags("");
    setNotes("");
  }

  const mut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          full_name: fullName.trim(),
          preferred_name: preferredName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          role_title: role.trim() || null,
          seniority: seniority.trim() || null,
          location: location.trim() || null,
          timezone: timezone.trim() || null,
          hire_date: hireDate || null,
          employment_type: employment,
          status,
          legal_entity_name: legalEntity.trim() || null,
          cnpj: cnpj.trim() || null,
          cost_hour: costHour ? Number(costHour) : null,
          monthly_cost: monthlyCost ? Number(monthlyCost) : null,
          currency: currency.trim() || "BRL",
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
            .slice(0, 20),
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      reset();
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova pessoa</DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo. Financeiros são visíveis apenas para quem tem permissão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Identificação
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="p-name">Nome completo *</Label>
                <Input
                  id="p-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Maria Silva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-preferred">Como prefere ser chamado(a)</Label>
                <Input
                  id="p-preferred"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-email">E-mail</Label>
                <Input
                  id="p-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-phone">Telefone</Label>
                <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-location">Localização</Label>
                <Input
                  id="p-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Cidade / UF"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Trabalho
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-role">Cargo / posição</Label>
                <Input id="p-role" value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-seniority">Senioridade</Label>
                <Input
                  id="p-seniority"
                  value={seniority}
                  onChange={(e) => setSeniority(e.target.value)}
                  placeholder="Ex: Pleno, Sênior"
                />
              </div>
              <div className="space-y-2">
                <Label>Vínculo</Label>
                <Select
                  value={employment}
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
                <Select value={status} onValueChange={(v) => setStatus(v as PeopleStatus)}>
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
                <Label htmlFor="p-hire">Data de contratação</Label>
                <Input
                  id="p-hire"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-tz">Fuso horário</Label>
                <Input id="p-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dados legais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-legal">Razão social</Label>
                <Input
                  id="p-legal"
                  value={legalEntity}
                  onChange={(e) => setLegalEntity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cnpj">CNPJ / CPF</Label>
                <Input id="p-cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Financeiro
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-cost-hour">Custo/hora</Label>
                <Input
                  id="p-cost-hour"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costHour}
                  onChange={(e) => setCostHour(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-monthly">Custo mensal</Label>
                <Input
                  id="p-monthly"
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthlyCost}
                  onChange={(e) => setMonthlyCost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cur">Moeda</Label>
                <Input
                  id="p-cur"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Notas & tags
            </h3>
            <div className="space-y-2">
              <Label htmlFor="p-tags">Tags (separadas por vírgula)</Label>
              <Input
                id="p-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="ex: pj-recorrente, sp, dev"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-notes">Notas internas</Label>
              <textarea
                id="p-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm"
                placeholder="Observações relevantes..."
              />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={mut.isPending || fullName.trim().length < 2}
            onClick={() => mut.mutate()}
          >
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
