import { getPublicAppUrl } from "@/lib/app-url";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";

type Ticket = { id: string; subject: string | null };

export function NewSurveyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}) {
  const [kind, setKind] = useState<"csat" | "nps">("csat");
  const [ticketId, setTicketId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("tickets")
        .select("id, subject")
        .order("created_at", { ascending: false })
        .limit(50);
      if (query.trim()) q = q.ilike("subject", `%${query.trim()}%`);
      const { data } = await q;
      if (!cancelled) setTickets((data ?? []) as Ticket[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  const selected = useMemo(() => tickets.find((t) => t.id === ticketId), [tickets, ticketId]);

  async function submit() {
    if (!ticketId) return toast.error("Selecione um ticket.");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Sessão não encontrada.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_workspace_id")
        .eq("id", userId)
        .maybeSingle();
      const workspaceId =
        (profile as { active_workspace_id: string | null } | null)?.active_workspace_id ?? null;
      const insert: Record<string, unknown> = { ticket_id: ticketId, kind, owner_id: userId };
      if (workspaceId) insert.workspace_id = workspaceId;
      const { data, error } = await (
        supabase as unknown as {
          from: (t: string) => {
            insert: (v: unknown) => {
              select: (c: string) => {
                single: () => Promise<{
                  data: { token: string } | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        }
      )
        .from("survey_responses")
        .insert(insert)
        .select("token")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Falha ao criar pesquisa.");
      const url = `${getPublicAppUrl()}/survey/${data.token}`;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success("Pesquisa criada. Link copiado.");
      onCreated?.();
      onOpenChange(false);
      setTicketId("");
      setQuery("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar pesquisa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pesquisa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "csat" | "nps")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csat">CSAT (0–5)</SelectItem>
                <SelectItem value="nps">NPS (0–10)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Buscar ticket por assunto</Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite parte do assunto…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ticket</Label>
            <Select value={ticketId} onValueChange={setTicketId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um ticket" />
              </SelectTrigger>
              <SelectContent>
                {tickets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.subject ?? t.id.slice(0, 8)}
                  </SelectItem>
                ))}
                {tickets.length === 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">Nenhum ticket.</div>
                )}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-xs text-muted-foreground truncate">
                Selecionado: {selected.subject ?? selected.id}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !ticketId}>
            Criar e copiar link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
