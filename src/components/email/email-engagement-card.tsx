// Card de engajamento de e-mail 1:1 mostrado dentro do timeline da entidade.
// Lista os e-mails enviados via o módulo de inbox/composer com contagem de
// aberturas, cliques e timestamps recentes.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, MousePointerClick, Mail, ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { listEntityEmailEngagement } from "@/lib/email-engagement.functions";

type RelatedKey = "related_lead_id" | "related_contact_id" | "related_company_id" | "related_deal_id";
const ENTITY_BY_KEY: Record<RelatedKey, "contact" | "lead" | "deal" | "company"> = {
  related_contact_id: "contact",
  related_lead_id: "lead",
  related_deal_id: "deal",
  related_company_id: "company",
};

function fmt(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return d;
  }
}

export function EmailEngagementCard({
  relatedKey,
  relatedId,
}: {
  relatedKey: RelatedKey;
  relatedId: string;
}) {
  const [open, setOpen] = useState(false);
  const fn = useServerFn(listEntityEmailEngagement);
  const { data: items = [] } = useQuery({
    queryKey: ["email-engagement", relatedKey, relatedId],
    queryFn: () => fn({ data: { entity: ENTITY_BY_KEY[relatedKey], entity_id: relatedId, limit: 20 } }),
  });

  if (!items.length) return null;

  const opened = items.filter((i) => i.open_count > 0 || i.first_opened_at).length;
  const clicked = items.filter((i) => i.click_count > 0).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2"
          onClick={() => setOpen((v) => !v)}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-mails enviados ({items.length})
            <Badge variant="secondary" className="gap-1">
              <Eye className="h-3 w-3" />
              {opened}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <MousePointerClick className="h-3 w-3" />
              {clicked}
            </Badge>
          </CardTitle>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          <div className="divide-y text-sm">
            {items.map((m) => (
              <div key={m.id} className="py-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{m.subject || "(sem assunto)"}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{fmt(m.sent_at)}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  Para: {(m.to_emails ?? []).join(", ") || "—"}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant={m.open_count > 0 ? "default" : "outline"} className="gap-1">
                    <Eye className="h-3 w-3" />
                    {m.open_count} abertura{m.open_count === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant={m.click_count > 0 ? "default" : "outline"} className="gap-1">
                    <MousePointerClick className="h-3 w-3" />
                    {m.click_count} clique{m.click_count === 1 ? "" : "s"}
                  </Badge>
                  {m.last_opened_at && (
                    <span className="text-muted-foreground">
                      Última abertura: {fmt(m.last_opened_at)}
                    </span>
                  )}
                  {m.last_clicked_at && (
                    <span className="text-muted-foreground truncate max-w-[260px]">
                      Último clique: {fmt(m.last_clicked_at)}
                      {m.last_clicked_url ? ` · ${m.last_clicked_url}` : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
