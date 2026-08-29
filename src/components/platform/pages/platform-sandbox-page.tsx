import { formatDateTime } from "@/lib/crm";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listSandboxes,
  createSandbox,
  promoteSandbox,
  archiveSandbox,
} from "@/lib/platform-observability.functions";
import { listAllWorkspaces } from "@/lib/platform-admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import { Plus } from "lucide-react";


export function AdminSandboxPage() {
  const { isPlatformAdmin, loading } = useIsPlatformAdmin();
  const qc = useQueryClient();
  const listFn = useServerFn(listSandboxes);
  const wsFn = useServerFn(listAllWorkspaces);
  const createFn = useServerFn(createSandbox);
  const promoteFn = useServerFn(promoteSandbox);
  const archiveFn = useServerFn(archiveSandbox);

  const sandboxes = useQuery({
    queryKey: ["sandboxes"],
    queryFn: () => listFn(),
    enabled: isPlatformAdmin,
  });
  const workspaces = useQuery({
    queryKey: ["all-workspaces"],
    queryFn: () => wsFn(),
    enabled: isPlatformAdmin,
  });

  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => createFn({ data: { source_workspace_id: sourceId, name } }),
    onSuccess: () => {
      toast.success("Sandbox criado");
      setOpen(false);
      setName("");
      setSourceId("");
      qc.invalidateQueries({ queryKey: ["sandboxes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promote = useMutation({
    mutationFn: (id: string) => promoteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Promovido");
      qc.invalidateQueries({ queryKey: ["sandboxes"] });
    },
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Arquivado");
      qc.invalidateQueries({ queryKey: ["sandboxes"] });
    },
  });

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!isPlatformAdmin) return <div className="p-6">Acesso restrito a super-admins.</div>;

  const wsMap = new Map((workspaces.data ?? []).map((w: any) => [w.id, w.name]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sandboxes</h1>
          <p className="text-sm text-muted-foreground">
            Workspaces espelho para testar workflows antes de promover.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo sandbox
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar sandbox</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Workspace de origem</Label>
                <Select value={sourceId} onValueChange={setSourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(workspaces.data ?? []).map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome do sandbox</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Teste workflows Q2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => create.mutate()}
                disabled={create.isPending || !sourceId || !name}
              >
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sandboxes ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {(sandboxes.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum sandbox criado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última sync</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sandboxes.data?.items ?? []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-xs">
                      {wsMap.get(s.source_workspace_id) ?? s.source_workspace_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          s.status === "promoted"
                            ? "default"
                            : s.status === "archived"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.last_synced_at ? formatDateTime(s.last_synced_at) : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {s.status === "active" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => promote.mutate(s.id)}>
                            Promover
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => archive.mutate(s.id)}>
                            Arquivar
                          </Button>
                        </>
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
