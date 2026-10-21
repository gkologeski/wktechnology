import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deactivateMemberWithTransfer,
  getMemberDeactivationInventory,
} from "@/lib/teams.functions";

type Member = {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  status?: string;
};
type Inventory = Awaited<ReturnType<typeof getMemberDeactivationInventory>>;
type ScopeKey =
  | "openDeals"
  | "closedDeals"
  | "leads"
  | "contactsCompanies"
  | "pendingActivities"
  | "openConversations";

const ITEMS: { key: ScopeKey; label: string; count: (i: Inventory) => number; hint?: string }[] = [
  { key: "openDeals", label: "Negócios abertos", count: (i) => i.deals_open },
  {
    key: "closedDeals",
    label: "Negócios ganhos/perdidos",
    count: (i) => i.deals_closed,
    hint: "Desmarcado por padrão para preservar o histórico de vendas.",
  },
  { key: "leads", label: "Leads ativos", count: (i) => i.leads_active },
  {
    key: "contactsCompanies",
    label: "Contatos e empresas",
    count: (i) => i.contacts + i.companies,
  },
  {
    key: "pendingActivities",
    label: "Tarefas e atividades pendentes",
    count: (i) => i.pending_activities,
  },
  {
    key: "openConversations",
    label: "Conversas abertas na Inbox",
    count: (i) => i.open_conversations,
  },
];

const DEFAULT_SCOPE: Record<ScopeKey, boolean> = {
  openDeals: true,
  closedDeals: false,
  leads: true,
  contactsCompanies: true,
  pendingActivities: true,
  openConversations: true,
};

export function DeactivateMemberDialog({
  member,
  candidates,
  onClose,
  onDone,
}: {
  member: Member | null;
  candidates: Member[];
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const inventoryFn = useServerFn(getMemberDeactivationInventory);
  const deactivateFn = useServerFn(deactivateMemberWithTransfer);
  const [inv, setInv] = useState<Inventory | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [target, setTarget] = useState<string>("");
  const [scope, setScope] = useState(DEFAULT_SCOPE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!member) return;
    setInv(null);
    setLoadError(null);
    setTarget("");
    setScope(DEFAULT_SCOPE);
    inventoryFn({ data: { member_user_id: member.user_id } })
      .then(setInv)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Erro ao analisar carteira"));
  }, [member, inventoryFn]);

  const total = inv ? ITEMS.reduce((s, it) => s + it.count(inv), 0) : 0;
  const active = candidates.filter((c) => c.user_id !== member?.user_id && c.status !== "inactive");

  const run = async (transfer: boolean) => {
    if (!member) return;
    setBusy(true);
    try {
      const res = await deactivateFn({
        data: {
          member_user_id: member.user_id,
          reassign_to: transfer ? target : null,
          scope,
        },
      });
      const moved = Object.values(res.transferred).reduce((s, n) => s + n, 0);
      toast.success(
        transfer
          ? `Usuário desativado. ${moved} registro(s) transferido(s).`
          : "Usuário desativado",
      );
      await onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao desativar");
    } finally {
      setBusy(false);
    }
  };

  const name = member?.full_name || member?.email;
  const anySelected = ITEMS.some((it) => scope[it.key] && inv && it.count(inv) > 0);

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Desativar usuário</DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{name}</strong> perderá o acesso. O nome e o
            histórico são preservados.
          </DialogDescription>
        </DialogHeader>

        {loadError && (
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
        )}
        {!inv && !loadError && (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {inv && total === 0 && (
          <p className="text-sm text-muted-foreground">
            Este usuário não tem registros na carteira para transferir.
          </p>
        )}
        {inv && total > 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="transfer-target">Transferir carteira para</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="transfer-target">
                  <SelectValue placeholder="Selecione um colaborador ativo" />
                </SelectTrigger>
                <SelectContent>
                  {active.map((c) => (
                    <SelectItem key={c.user_id} value={c.user_id}>
                      {c.full_name || c.email || c.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <fieldset className="space-y-2 rounded-md border p-3">
              <legend className="px-1 text-xs text-muted-foreground">O que transferir</legend>
              {ITEMS.map((it) => {
                const n = it.count(inv);
                return (
                  <div key={it.key} className="flex items-start gap-2">
                    <Checkbox
                      id={`scope-${it.key}`}
                      checked={scope[it.key]}
                      disabled={n === 0}
                      onCheckedChange={(v) => setScope((s) => ({ ...s, [it.key]: v === true }))}
                    />
                    <div className="grid gap-0.5 leading-tight">
                      <Label htmlFor={`scope-${it.key}`} className="text-sm font-normal">
                        {it.label} <span className="text-muted-foreground">({n})</span>
                      </Label>
                      {it.hint && <span className="text-xs text-muted-foreground">{it.hint}</span>}
                    </div>
                  </div>
                );
              })}
            </fieldset>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          {inv && total > 0 ? (
            <>
              <Button variant="outline" onClick={() => void run(false)} disabled={busy}>
                Só desativar
              </Button>
              <Button onClick={() => void run(true)} disabled={busy || !target || !anySelected}>
                {busy ? "Processando…" : "Transferir e desativar"}
              </Button>
            </>
          ) : (
            <Button onClick={() => void run(false)} disabled={busy || !inv}>
              {busy ? "Processando…" : "Desativar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
