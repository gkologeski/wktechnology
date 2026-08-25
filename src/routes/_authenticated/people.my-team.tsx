// TechPeople — /people/my-team
// Página do gestor com visão consolidada dos liderados diretos.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Briefcase, Clock, AlertTriangle, Calendar, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMyTeam } from "@/lib/people/my-team.functions";

export const Route = createFileRoute("/_authenticated/people/my-team")({
  head: () => ({
    meta: [
      { title: "Meu time · TechPeople" },
      {
        name: "description",
        content:
          "Visão consolidada dos liderados diretos: alocações, horas do mês, aprovações pendentes e documentos a vencer.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyTeamPage,
});

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MyTeamPage() {
  const fn = useServerFn(getMyTeam);
  const q = useQuery({
    queryKey: ["my-team"],
    queryFn: () => fn(),
  });
  const members = q.data?.members ?? [];

  const totals = members.reduce(
    (acc, m) => {
      acc.hours += m.hours_this_month;
      acc.pending += m.pending_approval_hours;
      acc.docs += m.docs_expiring_30d;
      return acc;
    },
    { hours: 0, pending: 0, docs: 0 },
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Meu time"
        description="Liderados diretos: alocações, horas, aprovações pendentes e documentos a vencer."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/people">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold truncate">{members.length}</div>
            <div className="text-xs text-muted-foreground mt-1">liderado(s)</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Horas no mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold truncate">{totals.hours.toFixed(1)}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Aprovação pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold truncate">{totals.pending.toFixed(1)}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Docs a vencer (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold truncate">{totals.docs}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liderados</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : members.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              Você ainda não tem liderados diretos cadastrados. Defina o gestor na ficha de cada
              pessoa para vê-los aqui.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Alocações</TableHead>
                  <TableHead className="text-right">Horas / mês</TableHead>
                  <TableHead className="text-right">A aprovar</TableHead>
                  <TableHead className="text-right">Docs 30d</TableHead>
                  <TableHead>Próxima 1:1</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link
                        to="/people/$id"
                        params={{ id: m.id }}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <Avatar className="h-8 w-8">
                          {m.photo_url && <AvatarImage src={m.photo_url} alt={m.full_name} />}
                          <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {m.preferred_name || m.full_name}
                          </span>
                          {m.email && (
                            <span className="text-xs text-muted-foreground">{m.email}</span>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{m.role_title ?? "—"}</span>
                        <Badge variant="outline" className="w-fit mt-1 text-xs">
                          {m.employment_type.toUpperCase()}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.active_allocations}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.hours_this_month.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.pending_approval_hours > 0 ? (
                        <Badge variant="secondary">{m.pending_approval_hours.toFixed(1)}h</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.docs_expiring_30d > 0 ? (
                        <Badge variant="destructive">{m.docs_expiring_30d}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.next_one_on_one ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {fmtDate(m.next_one_on_one)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
