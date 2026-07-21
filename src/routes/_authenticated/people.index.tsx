// /people — lista de pessoas (TechPeople).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Search, UserCog, ClipboardList, BarChart3 } from "lucide-react";

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

export const Route = createFileRoute("/_authenticated/people/")({
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

  const { data: rows = [], isLoading } = useQuery({
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
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Vínculo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contratação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
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
                    <Link
                      to="/people/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={p.photo_url ?? undefined} alt={p.full_name} />
                        <AvatarFallback className="text-xs">
                          {initials(p.full_name)}
                        </AvatarFallback>
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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [employment, setEmployment] = useState<PeopleEmploymentType>("pj");

  const mut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          full_name: fullName,
          email: email || null,
          role_title: role || null,
          employment_type: employment,
          status: "active",
          currency: "BRL",
          tags: [],
        },
      }),
    onSuccess: () => {
      setFullName("");
      setEmail("");
      setRole("");
      setEmployment("pj");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pessoa</DialogTitle>
          <DialogDescription>
            Cadastro básico. Você pode completar dados sensíveis (custo, docs) na ficha depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Nome completo *</Label>
            <Input
              id="p-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Maria Silva"
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
            <Label htmlFor="p-role">Cargo / posição</Label>
            <Input id="p-role" value={role} onChange={(e) => setRole(e.target.value)} />
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
