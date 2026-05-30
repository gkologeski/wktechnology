import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Mail, Phone, Smartphone, User } from "lucide-react";
import { getLeadPrimaryContact } from "@/lib/lead-primary-contact.functions";

export function PrimaryContactPanel({ leadId }: { leadId: string }) {
  const fetchFn = useServerFn(getLeadPrimaryContact);
  const { data, isLoading } = useQuery({
    queryKey: ["lead-primary-contact", leadId],
    queryFn: () => fetchFn({ data: { leadId } }),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contato primário (HubSpot)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Carregando…</p>
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const title = (
    <div className="flex items-center justify-between gap-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        Contato primário (HubSpot)
      </CardTitle>
      {data.hubspotLeadUrl && (
        <a
          href={data.hubspotLeadUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          Abrir Lead no HubSpot <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );

  if (data.empty) {
    return (
      <Card>
        <CardHeader>{title}</CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Este Lead do HubSpot não possui contato primário associado. No
            HubSpot, e-mail e telefone ficam no objeto Contato — quando não há
            contato vinculado, esses campos ficam vazios aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.local) {
    const c = data.local;
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
    return (
      <Card>
        <CardHeader>{title}</CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <Link
              to="/contacts/$id"
              params={{ id: c.id }}
              className="font-medium hover:underline truncate"
            >
              {name}
            </Link>
            <Badge variant="outline" className="text-[10px]">
              Importado
            </Badge>
          </div>
          {c.job_title && (
            <p className="text-xs text-muted-foreground truncate">
              {c.job_title}
              {c.company_name ? ` · ${c.company_name}` : ""}
            </p>
          )}
          <Row icon={<Mail className="h-3.5 w-3.5" />} value={c.email} />
          <Row icon={<Phone className="h-3.5 w-3.5" />} value={c.phone} />
          <Row
            icon={<Smartphone className="h-3.5 w-3.5" />}
            value={c.mobile_phone}
          />
          <div className="pt-1">
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link to="/contacts/$id" params={{ id: c.id }}>
                Abrir contato
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.hubspot) {
    const h = data.hubspot;
    const name = [h.firstName, h.lastName].filter(Boolean).join(" ") || "—";
    return (
      <Card>
        <CardHeader>{title}</CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">{name}</span>
            <Badge variant="secondary" className="text-[10px]">
              Só no HubSpot
            </Badge>
          </div>
          {h.jobTitle && (
            <p className="text-xs text-muted-foreground truncate">
              {h.jobTitle}
              {h.company ? ` · ${h.company}` : ""}
            </p>
          )}
          <Row icon={<Mail className="h-3.5 w-3.5" />} value={h.email} />
          <Row icon={<Phone className="h-3.5 w-3.5" />} value={h.phone} />
          <Row
            icon={<Smartphone className="h-3.5 w-3.5" />}
            value={h.mobilePhone}
          />
          {data.hubspotContactId && (
            <p className="text-[11px] text-muted-foreground pt-1">
              HubSpot Contact ID:{" "}
              <a
                href={`https://app.hubspot.com/contacts/_/record/0-1/${data.hubspotContactId}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {data.hubspotContactId}
              </a>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>{title}</CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Contato primário (HubSpot ID {data.hubspotContactId}) ainda não foi
          importado para o CRM.
          {data.hubspotError ? ` — ${data.hubspotError}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}

function Row({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}
