// Origem do projeto: cliente, contato, negócio(s), contrato, serviço, item de origem, responsável
// operacional e pendências. Negócios sem acesso aparecem só como "sem acesso", sem nome nem valor.
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/techhire/ui";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import {
  getProjectDeliveryOrigin,
  setProjectOperationalOwner,
} from "@/lib/projects/deal-delivery.functions";
import {
  BLOCKING_PENDING,
  LINK_LABEL,
  PROJECT_ORIGIN_LABEL,
  REVIEW_LABEL,
  formatHms,
  groupLabel,
  pendingLabel,
} from "@/lib/projects/deal-delivery-labels";

const NONE = "__none__";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function ProjectOriginCard({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const get = useServerFn(getProjectDeliveryOrigin);
  const setOwner = useServerFn(setProjectOperationalOwner);
  const members = useWorkspaceMembers();
  const key = ["project-delivery-origin", projectId];
  const q = useQuery({ queryKey: key, queryFn: () => get({ data: { projectId } }) });
  const m = useMutation({
    mutationFn: (userId: string | null) => setOwner({ data: { projectId, userId } }),
    onSuccess: () => {
      toast.success("Responsável operacional atualizado. Nenhuma permissão foi concedida.");
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Origem e cliente</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : q.isError || !q.data ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar a origem do projeto.
            </p>
            <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <dl className="space-y-2">
            <Row label="Origem">
              {q.data.origin
                ? PROJECT_ORIGIN_LABEL[q.data.origin]
                : q.data.imported_from.length > 0
                  ? `Importado (${q.data.imported_from.map((s) => (s === "clockify" ? "Clockify" : "Jibble")).join(" e ")})`
                  : "Sem negócio de origem (interno ou anterior)"}
            </Row>
            <Row label="Cliente">
              {q.data.company ? (
                <Link
                  to="/companies/$id"
                  params={{ id: q.data.company.id }}
                  className="hover:underline"
                >
                  {q.data.company.name}
                </Link>
              ) : (
                "Não definido"
              )}
            </Row>
            {q.data.contact && (
              <Row label="Contato">
                <Link
                  to="/contacts/$id"
                  params={{ id: q.data.contact.id }}
                  className="hover:underline"
                >
                  {q.data.contact.name || "Contato"}
                </Link>
              </Row>
            )}
            <Row label="Negócio(s)">
              {q.data.deals.length === 0 ? (
                "Nenhum"
              ) : (
                <ul className="space-y-1">
                  {q.data.deals.map((d, i) =>
                    d.visible ? (
                      <li key={d.id}>
                        <Link to="/deals/$id" params={{ id: d.id }} className="hover:underline">
                          {d.name}
                        </Link>{" "}
                        <span className="text-xs text-muted-foreground">
                          · {LINK_LABEL[d.link] ?? d.link} · {groupLabel(d.group_key)}
                        </span>
                      </li>
                    ) : (
                      <li key={`hidden-${i}`} className="text-muted-foreground">
                        Negócio sem acesso ({LINK_LABEL[d.link] ?? d.link})
                      </li>
                    ),
                  )}
                </ul>
              )}
            </Row>
            {q.data.source_line_item && (
              <Row label="Item de origem">
                {q.data.source_line_item.name} · {q.data.source_line_item.quantity}{" "}
                {q.data.source_line_item.unit ?? ""}
              </Row>
            )}
            <Row label="Contrato">
              {q.data.contract ? (
                <Link
                  to="/contracts/$id"
                  params={{ id: q.data.contract.id }}
                  className="hover:underline"
                >
                  {q.data.contract.label}
                </Link>
              ) : q.data.contractHidden ? (
                "Contrato sem acesso"
              ) : (
                "Sem contrato (não obrigatório)"
              )}
            </Row>
            <Row label="Serviço">
              {q.data.service ? (
                <Link
                  to="/services/$id"
                  params={{ id: q.data.service.id }}
                  className="hover:underline"
                >
                  {q.data.service.name}
                </Link>
              ) : q.data.serviceHidden ? (
                "Serviço sem acesso"
              ) : (
                "Não definido"
              )}
            </Row>
            <Row label="Responsável operacional">
              {q.data.can.edit ? (
                <Select
                  value={q.data.assigned?.id ?? NONE}
                  disabled={m.isPending}
                  onValueChange={(v) => m.mutate(v === NONE ? null : v)}
                >
                  <SelectTrigger
                    className="h-8 w-full max-w-xs"
                    aria-label="Responsável operacional"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Não definido</SelectItem>
                    {(members.data ?? []).map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name ?? members.nameFor(u.user_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                (q.data.assigned?.name ?? "Não definido")
              )}
            </Row>
            <Row label="Horas apontadas">
              <span className="tabular-nums">{formatHms(q.data.logged_seconds)}</span>
            </Row>
            {(q.data.pending.length > 0 || q.data.reviews.length > 0) && (
              <Row label="Pendências">
                <ul className="flex flex-wrap gap-1.5">
                  {q.data.pending.map((p) => (
                    <li key={p}>
                      <StatusBadge
                        status={BLOCKING_PENDING.has(p) ? "onhold" : "draft"}
                        label={pendingLabel(p)}
                      />
                    </li>
                  ))}
                  {q.data.reviews.map((r) => (
                    <li key={r.id}>
                      <StatusBadge status="onhold" label={REVIEW_LABEL[r.kind] ?? r.kind} />
                    </li>
                  ))}
                </ul>
              </Row>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
