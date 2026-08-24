// Atribuição de responsável em massa para qualquer tabela com coluna `assigned_to`.
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";

const NONE = "__none__";

export function BulkAssignDialog({
  open,
  setOpen,
  table,
  ids,
  column = "assigned_to",
  onDone,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  table: string;
  ids: string[];
  column?: string;
  onDone: () => void;
}) {
  const { data: members, nameFor } = useWorkspaceMembers();
  const [value, setValue] = useState<string>(NONE);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (ids.length === 0) return;
    setBusy(true);
    const next = value === NONE ? null : value;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const run = (payload: Record<string, unknown>) =>
      client.from(table).update(payload).in("id", ids).select("id");
    // Tabelas de CRM mantêm a coluna legada `assigned_user_id`, lida por telas
    // e por RLS: quando existir, grava as duas para não gerar sucesso falso.
    let { data: affected, error } =
      column === "assigned_to"
        ? await run({ assigned_to: next, assigned_user_id: next })
        : await run({ [column]: next });
    if (error && column === "assigned_to") {
      ({ data: affected, error } = await run({ assigned_to: next }));
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    if (deniedIfUnaffected(affected)) return;

    const changed = (affected as unknown[]).length;
    if (changed < ids.length) {
      toast.warning(`${changed} de ${ids.length} atualizado(s). Verifique suas permissões.`);
    } else {
      toast.success(`Responsável definido em ${changed} registro(s)`);
    }
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atribuir responsável</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">
          Define o responsável de {ids.length.toLocaleString("pt-BR")} registro(s) selecionado(s).
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-assignee">Responsável</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id="bulk-assignee">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem responsável</SelectItem>
              {(members ?? []).map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {nameFor(m.user_id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Salvando…" : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
