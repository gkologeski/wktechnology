// Card em /settings/teams: contas com login criado que não estão vinculadas a
// nenhum workspace (cadastro direto, sem convite). Permite vincular na hora.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { listUnlinkedAccounts, linkUnlinkedAccount } from "@/lib/teams/unlinked.functions";

type Role = "admin" | "manager" | "member";
const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Gestor",
  member: "Membro",
};

export function UnlinkedAccountsCard({ onLinked }: { onLinked?: () => void }) {
  const listFn = useServerFn(listUnlinkedAccounts);
  const linkFn = useServerFn(linkUnlinkedAccount);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [linking, setLinking] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["settings-teams", "unlinked-accounts"],
    queryFn: () => listFn(),
  });

  const accounts = data?.accounts ?? [];

  async function handleLink(userId: string) {
    setLinking(userId);
    try {
      await linkFn({ data: { user_id: userId, role: roles[userId] ?? "member" } });
      toast.success("Conta vinculada ao workspace.");
      await refetch();
      onLinked?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível vincular a conta.");
    } finally {
      setLinking(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Contas sem workspace
        </CardTitle>
        <CardDescription>
          Logins criados sem convite não aparecem na lista de membros. Vincule-os aqui definindo o
          papel de acesso.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : isError ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Não foi possível carregar as contas sem workspace.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma conta pendente de vínculo. Todos os logins pertencem a um workspace.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="w-40">Papel</TableHead>
                  <TableHead className="w-28 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.user_id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 font-medium">
                          {a.full_name || a.email || a.user_id.slice(0, 8)}
                          {a.same_domain && (
                            <Badge variant="secondary">Mesmo domínio</Badge>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">{a.email ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.last_sign_in_at
                        ? new Date(a.last_sign_in_at).toLocaleDateString("pt-BR")
                        : "Nunca acessou"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={roles[a.user_id] ?? "member"}
                        onValueChange={(v) =>
                          setRoles((prev) => ({ ...prev, [a.user_id]: v as Role }))
                        }
                      >
                        <SelectTrigger aria-label={`Papel de ${a.email ?? a.user_id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleLink(a.user_id)}
                        disabled={linking === a.user_id}
                      >
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        {linking === a.user_id ? "Vinculando…" : "Vincular"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
