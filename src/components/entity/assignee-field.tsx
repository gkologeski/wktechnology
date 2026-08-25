import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { assertAffected } from "@/lib/access-control/rls-denied";
import { handlePermissionError } from "@/lib/access-control/handle-permission-error";

import { supabase } from "@/integrations/supabase/client";
import { listWorkspaceTeam } from "@/lib/workspace-invites.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Campo "Responsável" reutilizável para telas de detalhe de qualquer entidade
 * que tenha a coluna `assigned_to`.
 *
 * A gravação é feita pelo cliente Supabase e validada pela RLS da tabela —
 * este componente não afrouxa nenhuma permissão.
 */
export function AssigneeField({
  table,
  rowId,
  assignedTo,
  column = "assigned_to",
  label = "Responsável",
  onChanged,
  compact = false,
  disabled = false,
}: {
  table: string;
  rowId: string;
  assignedTo: string | null | undefined;
  column?: string;
  label?: string;
  onChanged?: (next: string | null) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const listFn = useServerFn(listWorkspaceTeam);
  const q = useQuery({
    queryKey: ["workspace-team", "assignee-field"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setMeId(data.user?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(assignedTo ?? null);
  useEffect(() => setCurrent(assignedTo ?? null), [assignedTo]);

  const members = q.data?.members ?? [];
  const currentName = useMemo(() => {
    const m = members.find((x) => x.user_id === current);
    if (!m) return current ? "—" : "Sem responsável";
    return m.full_name || m.email || "Membro";
  }, [members, current]);

  const change = async (val: string) => {
    const next = val === "__none__" ? null : val;
    if (next === current) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: affected, error } = await (supabase as any)
        .from(table)
        .update({ [column]: next })
        .eq("id", rowId)
        .select("id");
      if (error) throw error;
      assertAffected(affected as unknown[] | null);
      setCurrent(next);
      onChanged?.(next);
      toast.success("Responsável atualizado");
    } catch (e) {
      if (!handlePermissionError(e))
        toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o responsável");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <UserCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </div>
      {disabled ? (
        <div className="text-sm text-foreground">{currentName}</div>
      ) : (
        <div className="flex items-center gap-2">
          <Select
            value={current ?? "__none__"}
            onValueChange={change}
            disabled={saving || q.isLoading}
          >
            <SelectTrigger className="h-8 text-sm" aria-label={label}>
              <SelectValue placeholder={q.isLoading ? "Carregando…" : "Selecionar"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem responsável</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name || m.email || m.user_id.slice(0, 8)}
                  {m.user_id === meId ? " (eu)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving && (
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </div>
  );
}
