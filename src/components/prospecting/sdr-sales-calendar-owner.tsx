// Proprietário da agenda de vendas: dono da agenda Google em que a Lia marca
// reuniões. Grava no rascunho das ferramentas (saveSdrToolConfig revalida).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSdrToolCatalog, saveSdrToolConfig } from "@/lib/prospecting/sdr-tools.functions";
import type { getCatalog } from "@/lib/prospecting/sdr/tools/admin.server";
import type { ToolConfig } from "@/lib/prospecting/sdr/tools/catalog";

type Catalog = Awaited<ReturnType<typeof getCatalog>>;
const NO_CAL = "__nocal__";

export function SdrSalesCalendarOwner({
  playbookId,
  members,
}: {
  playbookId: string;
  members: { user_id: string; full_name: string | null }[];
}) {
  // Espelho da permissão; saveSdrToolConfig revalida no servidor.
  const canSave = usePermissions().canAny([
    "techsales.marketing.sdr_agent.update.own",
    "techsales.marketing.sdr_agent.update.team",
    "techsales.marketing.sdr_agent.update.workspace",
  ]);
  const fetchCat = useServerFn(getSdrToolCatalog);
  const save = useServerFn(saveSdrToolConfig);
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const q = useQuery({
    queryKey: ["sdr-tools", playbookId],
    queryFn: async () => JSON.parse((await fetchCat({ data: { playbookId } })).json) as Catalog,
  });
  const c = q.data;
  const s = c?.draft?.scheduling ?? null;
  const withCal = new Set((c?.calendars ?? []).map((a) => a.owner_id));
  const others = members.filter((m) => !withCal.has(m.user_id));

  async function onPick(accountId: string) {
    const a = c?.calendars.find((x) => x.id === accountId);
    if (!a || !c?.draft || !s) return;
    setSaving(true);
    try {
      const config: ToolConfig = {
        ...c.draft,
        scheduling: { ...s, calendar_account_id: a.id, host_user_id: a.owner_id },
      };
      await save({ data: { playbookId, config } });
      toast.success("Proprietário da agenda salvo no rascunho. Publique para valer na Lia.");
      await qc.invalidateQueries({ queryKey: ["sdr-tools", playbookId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="cfg-calendar-owner">2. Proprietário da agenda de vendas</Label>
      <p className="text-xs text-muted-foreground">
        A Lia consulta a agenda dessa pessoa e marca as reuniões nela, com link do Meet.
      </p>
      {q.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">Carregando agendas…</p>
      ) : q.error ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as agendas.
        </p>
      ) : !s ? (
        <p className="text-sm text-muted-foreground">
          Agendamento direto ainda não definido. Ative-o em Habilidades e ferramentas.
        </p>
      ) : (
        <Select
          value={s.calendar_account_id}
          onValueChange={(v) => v !== NO_CAL && onPick(v)}
          disabled={!canSave || saving}
        >
          <SelectTrigger id="cfg-calendar-owner" className="[&>span]:truncate">
            <SelectValue placeholder="Escolha o proprietário" />
          </SelectTrigger>
          <SelectContent>
            {c!.calendars.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.owner_name} · {a.email}
                {a.status === "error" ? " (agenda com erro)" : ""}
              </SelectItem>
            ))}
            {others.map((m) => (
              <SelectItem key={m.user_id} value={`${NO_CAL}${m.user_id}`} disabled>
                {m.full_name || "Sem nome"} — Sem agenda conectada
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <p className="text-xs text-muted-foreground">
        Só podem ser escolhidas pessoas com agenda do Google conectada. Para incluir alguém, essa
        pessoa deve conectar a agenda em Configurações › Agenda.
      </p>
    </div>
  );
}
