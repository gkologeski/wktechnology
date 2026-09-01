import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2, Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkLeadDuplicate } from "@/lib/leads/lead-duplicate-check";
import { isEmail } from "@/lib/validators";

export type ContactSearchResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_id: string | null;
  company_name: string | null;
  companies: { id: string; name: string } | null;
};

// Remove caracteres que quebram o filtro .or() do PostgREST
function sanitizeOrTerm(q: string) {
  return q.replace(/[,()%]/g, " ").trim();
}

function fullName(c: ContactSearchResult) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sem nome";
}

/**
 * Primeiro passo do "Criar lead": procura na base de contatos e avisa quando já
 * existe lead com o mesmo e-mail/telefone.
 */
export function LeadContactSearchStep({
  onPickContact,
  onStartBlank,
  onCancel,
}: {
  onPickContact: (contact: ContactSearchResult) => void;
  onStartBlank: (initialQuery: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<ContactSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dupLead, setDupLead] = useState<{ id: string; message: string } | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const term = sanitizeOrTerm(query);
    if (term.length < 3) {
      setResults([]);
      setSearched(false);
      setDupLead(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const req = ++reqRef.current;
    const timer = setTimeout(async () => {
      try {
        const digits = term.replace(/\D/g, "");
        const isMail = isEmail(term);
        const [contactsRes, dup] = await Promise.all([
          supabase
            .from("contacts")
            .select(
              "id, first_name, last_name, email, phone, company_id, company_name, companies(id, name)",
            )
            .or(
              [
                `email.ilike.%${term}%`,
                `first_name.ilike.%${term}%`,
                `last_name.ilike.%${term}%`,
                ...(digits.length >= 4 ? [`phone.ilike.%${digits}%`] : []),
              ].join(","),
            )
            .is("deleted_at", null)
            .limit(8),
          checkLeadDuplicate(supabase, {
            email: isMail ? term : null,
            phone: !isMail && digits.length >= 8 ? term : null,
          }).catch(() => null),
        ]);
        if (req !== reqRef.current) return;
        if (contactsRes.error) {
          setError("Não foi possível buscar contatos. Tente novamente.");
          setResults([]);
        } else {
          setError(null);
          setResults((contactsRes.data ?? []) as unknown as ContactSearchResult[]);
        }
        setDupLead(
          dup?.duplicate && dup.existingId
            ? { id: dup.existingId, message: dup.message ?? "Já existe um lead com esses dados." }
            : null,
        );
        setSearched(true);
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="grid gap-3 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="lead_contact_search">Buscar contato</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="lead_contact_search"
            className="pl-8"
            value={query}
            autoFocus
            placeholder="E-mail, nome ou telefone"
            aria-describedby="lead_contact_search-hint"
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <p id="lead_contact_search-hint" className="text-[11px] text-muted-foreground">
          Procuramos primeiro na sua base de contatos para reaproveitar os dados.
        </p>
      </div>

      {dupLead && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-2">
            <p className="text-destructive">{dupLead.message}</p>
            <Button asChild size="sm" variant="outline">
              <Link to="/leads/$id" params={{ id: dupLead.id }} onClick={onCancel}>
                Abrir lead existente
              </Link>
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <ul className="divide-y rounded-md border">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPickContact(c)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="text-sm font-medium">{fullName(c)}</span>
                <span className="text-xs text-muted-foreground">
                  {[c.email, c.companies?.name ?? c.company_name].filter(Boolean).join(" · ") ||
                    "Sem e-mail"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Nenhum contato encontrado. Você pode criar o lead do zero.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="secondary" onClick={() => onStartBlank(query)} disabled={!!dupLead}>
          <UserPlus className="size-4" />
          Criar do zero
        </Button>
      </div>
    </div>
  );
}
