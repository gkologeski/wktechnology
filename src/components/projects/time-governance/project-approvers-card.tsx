// Aprovadores e gestor operacional do projeto, com recorte por profissional, vigência e
// delegação. O vendedor nunca é aprovador implícito; sem aprovador o envio fica bloqueado.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { SectionHeader, EmptyState, RowSkeleton } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import {
  listProjectApprovers,
  revokeProjectApprover,
  setProjectApprover,
} from "@/lib/projects/time-governance.functions";

const ROLE_LABEL = {
  approver: "Aprovador de horas",
  operational_manager: "Gestor operacional",
} as const;
const br = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "sem fim");

export function ProjectApproversCard({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listProjectApprovers);
  const setFn = useServerFn(setProjectApprover);
  const revokeFn = useServerFn(revokeProjectApprover);
  const members = useWorkspaceMembers();

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"approver" | "operational_manager">("approver");
  const [subject, setSubject] = useState("all");
  const [delegateOf, setDelegateOf] = useState("none");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: ["project-approvers", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["project-approvers", projectId] });

  const add = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          projectId,
          userId,
          role,
          subjectUserId: subject === "all" ? null : subject,
          delegateOf: delegateOf === "none" ? null : delegateOf,
          validFrom: validFrom || null,
          validTo: validTo || null,
          reason: reason.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Responsável registrado");
      setUserId("");
      setSubject("all");
      setDelegateOf("none");
      setReason("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (v: { id: string; reason: string }) => revokeFn({ data: v }),
    onSuccess: () => {
      toast.success("Responsável revogado");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data?.approvers ?? [];
  const names = q.data?.names ?? {};
  const active = rows.filter((r) => !r.revoked_at);
  const people = members.data ?? [];
  const nameOf = (id: string | null) => (id ? (names[id] ?? members.nameFor(id)) : "Todos");
  const delegatable = active.filter((r) => r.role === "approver" && !r.delegate_of);
  const hasApprover = active.some((r) => r.role === "approver");

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <SectionHeader
        title="Aprovadores e gestor operacional"
        description="Quem decide as horas deste projeto. Ninguém aprova as próprias horas; delegação tem vigência e fica auditada."
      />
      {!q.isLoading && !hasApprover && (
        <p className="rounded-md border border-dashed p-2 text-sm" role="status">
          Projeto sem aprovador de horas: os envios dos profissionais ficam bloqueados até alguém
          ser nomeado aqui.
        </p>
      )}
      {q.isLoading ? (
        <RowSkeleton />
      ) : q.isError ? (
        <EmptyState title="Não foi possível carregar" description={(q.error as Error).message} />
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">Nenhum responsável registrado.</li>
          )}
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {nameOf(r.user_id)}{" "}
                  <Badge variant="secondary" className="ml-1">
                    {ROLE_LABEL[r.role]}
                  </Badge>
                  {r.delegate_of && (
                    <Badge variant="outline" className="ml-1">
                      Delegado
                    </Badge>
                  )}
                  {r.revoked_at && (
                    <Badge variant="outline" className="ml-1">
                      Revogado
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Profissionais: {nameOf(r.subject_user_id)} · de {br(r.valid_from)} a{" "}
                  {br(r.valid_to)}
                  {r.reason ? ` · ${r.reason}` : ""}
                </p>
              </div>
              {!r.revoked_at && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revoke.isPending}
                  onClick={() =>
                    void confirmDialog({
                      title: "Revogar responsável?",
                      description:
                        "Envios pendentes deixam de poder ser decididos por esta pessoa.",
                      confirmLabel: "Revogar",
                      variant: "destructive",
                    }).then(
                      (ok) =>
                        ok && revoke.mutate({ id: r.id, reason: "Revogado na ficha do projeto" }),
                    )
                  }
                >
                  Revogar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ap-user">Pessoa</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger id="ap-user">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {people.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name ?? m.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-role">Papel</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger id="ap-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approver">Aprovador de horas</SelectItem>
              <SelectItem value="operational_manager">Gestor operacional</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-subject">Aprova horas de</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger id="ap-subject">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais do projeto</SelectItem>
              {people.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name ?? m.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-delegate">Substitui (delegação)</Label>
          <Select value={delegateOf} onValueChange={setDelegateOf}>
            <SelectTrigger id="ap-delegate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não é delegação</SelectItem>
              {delegatable.map((r) => (
                <SelectItem key={r.id} value={r.user_id}>
                  {nameOf(r.user_id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-from">Vigência: início</Label>
          <Input
            id="ap-from"
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-to">Vigência: fim (opcional)</Label>
          <Input
            id="ap-to"
            type="date"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="ap-reason">Motivo / observação</Label>
          <Input
            id="ap-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: férias do líder"
          />
        </div>
        <div className="flex items-end">
          <Button
            className="w-full"
            disabled={!userId || add.isPending}
            onClick={() => add.mutate()}
          >
            {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </div>
      </div>
    </section>
  );
}
