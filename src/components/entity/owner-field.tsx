import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listWorkspaceTeam } from "@/lib/workspace-invites.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { assertAffected } from "@/lib/access-control/rls-denied";
import { handlePermissionError } from "@/lib/access-control/handle-permission-error";

/**
 * Campo Proprietário reutilizável para telas de detalhe de qualquer entidade
 * que tenha a coluna owner_id (contatos, empresas, deals, leads, tickets,
 * candidatos, vagas, etc.). Exibido em destaque no topo da seção "Sobre".
 *
 * Permissão de edição: admin/manager do workspace, ou o próprio proprietário
 * atual. Fora disso, é somente leitura. O UPDATE final é feito via cliente
 * Supabase e validado pela RLS da tabela.
 */
export function OwnerField({
  table,
  rowId,
  ownerId,
  onChanged,
  compact = false,
}: {
  table: string;
  rowId: string;
  ownerId: string | null | undefined;
  onChanged?: (newOwnerId: string | null) => void;
  compact?: boolean;
}) {
  const listFn = useServerFn(listWorkspaceTeam);
  const q = useQuery({
    queryKey: ["workspace-team", "owner-field"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    let m = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (m) setMeId(data.user?.id ?? null);
    });
    return () => {
      m = false;
    };
  }, []);

  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(ownerId ?? null);
  useEffect(() => setCurrent(ownerId ?? null), [ownerId]);

  const members = q.data?.members ?? [];
  const meRole = useMemo(
    () => members.find((m) => m.user_id === meId)?.role ?? null,
    [members, meId],
  );
  const canEdit =
    meRole === "admin" ||
    meRole === "manager" ||
    (meId != null && current === meId) ||
    current == null;

  const ownerName = useMemo(() => {
    const m = members.find((x) => x.user_id === current);
    if (!m) return current ? "—" : "Sem proprietário";
    return m.full_name || m.email || "Membro";
  }, [members, current]);

  const change = async (val: string) => {
    const nv = val === "__none__" ? null : val;
    if (nv === current) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: affected, error } = await (supabase as any)
        .from(table)
        .update({ owner_id: nv })
        .eq("id", rowId)
        .select("id");
      if (error) throw error;
      assertAffected(affected as unknown[] | null);
      setCurrent(nv);
      onChanged?.(nv);
      toast.success("Proprietário atualizado");
    } catch (e) {
      if (!handlePermissionError(e))
        toast.error(e instanceof Error ? e.message : "Não foi possível atualizar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <UserCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Proprietário</span>
      </div>
      {canEdit ? (
        <div className="flex items-center gap-2">
          <Select
            value={current ?? "__none__"}
            onValueChange={change}
            disabled={saving || q.isLoading}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={q.isLoading ? "Carregando..." : "Selecionar"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem proprietário</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name || m.email || m.user_id.slice(0, 8)}
                  {m.user_id === meId ? " (eu)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
      ) : (
        <div className="text-sm text-foreground">{ownerName}</div>
      )}
    </div>
  );
}
