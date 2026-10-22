// Caixa de vários termos (pills) para "contém"/"não contém" no público WhatsApp.
import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { MAX_FILTER_TERMS } from "@/lib/whatsapp/campaign-audience";
import { cn } from "@/lib/utils";

export function addTerm(terms: string[], raw: string): string[] {
  const t = raw.trim().slice(0, 100);
  if (!t || terms.length >= MAX_FILTER_TERMS) return terms;
  const k = t.toLocaleLowerCase("pt-BR");
  if (terms.some((x) => x.toLocaleLowerCase("pt-BR") === k)) return terms;
  return [...terms, t];
}

export function TermPills({
  terms,
  onRemove,
  label,
}: {
  terms: string[];
  onRemove: (i: number) => void;
  label: string;
}) {
  return (
    <>
      {terms.map((t, i) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
        >
          <span className="max-w-32 truncate">{t}</span>
          <span
            role="button"
            tabIndex={0}
            className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Remover termo ${t} de ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(i);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onRemove(i);
              }
            }}
          >
            <X className="h-3 w-3" />
          </span>
        </span>
      ))}
    </>
  );
}

export function AudienceTermsInput({
  terms,
  onChange,
  label,
  className,
}: {
  terms: string[];
  onChange: (terms: string[]) => void;
  label: string;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    if (!draft.trim()) return;
    onChange(addTerm(terms, draft));
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && terms.length) {
      onChange(terms.slice(0, -1));
    }
  };
  return (
    <div
      className={cn(
        "flex min-h-9 w-72 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      <TermPills
        terms={terms}
        label={label}
        onRemove={(i) => onChange(terms.filter((_, j) => j !== i))}
      />
      <input
        className="min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        aria-label={`Termos do filtro ${label}`}
        placeholder={terms.length ? "" : "Digite e tecle Enter"}
        maxLength={100}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
      />
    </div>
  );
}
