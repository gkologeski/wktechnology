import { Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, Lock, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Field = { label: string; value: string | null | undefined };

function FieldList({ fields }: { fields: Field[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.label} className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">{f.label}</dt>
          <dd className="text-sm text-foreground break-words">{f.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function useOwnerName(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["company-portfolio-owner", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.rpc("company_portfolio_owner", { _company_id: companyId! });
      const row = Array.isArray(data) ? data[0] : null;
      return (row?.owner_name as string | null) ?? null;
    },
  }).data;
}

function Shell({
  backTo,
  icon,
  title,
  subtitle,
  children,
}: {
  backTo: "/companies" | "/contacts";
  icon: React.ReactNode;
  title: string;
  subtitle?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link to={backTo} aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div
        role="note"
        className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
      >
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Ficha resumida, somente leitura. Este registro pertence a outra pessoa e aparece porque
          está ligado a um lead ou negócio seu.
        </span>
      </div>
      {children}
    </div>
  );
}

type CompanyLike = {
  id: string;
  name: string;
  cnpj?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  website?: string | null;
};

export function LinkedCompanySummary({ company }: { company: CompanyLike }) {
  const ownerName = useOwnerName(company.id);
  const contactsQ = useQuery({
    queryKey: ["linked-company-contacts", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, job_title, email, phone")
        .eq("company_id", company.id)
        .is("deleted_at", null)
        .order("first_name")
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Shell
      backTo="/companies"
      icon={<Building2 className="h-6 w-6" />}
      title={company.name}
      subtitle={company.industry}
    >
      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <FieldList
          fields={[
            { label: "CNPJ", value: company.cnpj },
            {
              label: "Cidade/UF",
              value: [company.city, company.state].filter(Boolean).join("/") || null,
            },
            { label: "Setor", value: company.industry },
            { label: "Site", value: company.website },
            { label: "Responsável", value: ownerName },
          ]}
        />
      </section>
      <section className="rounded-2xl border border-border/60 bg-card p-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Contatos da empresa</h2>
        {contactsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : contactsQ.error ? (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar os contatos. Recarregue a página.
          </p>
        ) : (contactsQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum contato cadastrado.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {(contactsQ.data ?? []).map((c) => (
              <li key={c.id} className="px-3 py-2 text-sm">
                <p className="font-medium text-foreground">
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Sem nome"}
                  {c.job_title && (
                    <span className="font-normal text-muted-foreground"> · {c.job_title}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "Sem e-mail ou telefone"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

type ContactLike = {
  first_name: string | null;
  last_name: string | null;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  company_id?: string | null;
};

export function LinkedContactSummary({
  contact,
  companyName,
}: {
  contact: ContactLike;
  companyName?: string | null;
}) {
  const ownerName = useOwnerName(contact.company_id);
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Sem nome";
  return (
    <Shell backTo="/contacts" icon={<User className="h-6 w-6" />} title={name} subtitle={companyName}>
      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <FieldList
          fields={[
            { label: "Cargo", value: contact.job_title },
            { label: "E-mail", value: contact.email },
            { label: "Telefone", value: contact.phone || contact.mobile_phone },
            { label: "Empresa", value: companyName },
            { label: "Responsável pela empresa", value: ownerName },
          ]}
        />
      </section>
    </Shell>
  );
}
