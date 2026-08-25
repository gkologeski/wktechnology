import { Link } from "@tanstack/react-router";
import { Trash2, Briefcase, Mail, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import { cn } from "@/lib/utils";
import type { DerivedCandidateStatus } from "@/lib/ats/candidate-status.functions";
import { CandidateStatusPill } from "./candidate-status-pill";
import type { Cand } from "./types";

export function CandidatesCardsView({
  visibleRows,
  statuses,
  onDelete,
}: {
  visibleRows: Cand[];
  statuses: Record<string, DerivedCandidateStatus>;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visibleRows.map((c) => {
        const skills = Array.isArray(c.skills) ? (c.skills as string[]) : [];
        const status = statuses[c.id as string] ?? "new";
        return (
          <article
            key={c.id as string}
            className={cn(
              "group relative rounded-lg border border-border-subtle bg-surface-1",
              "p-4 shadow-xs transition-all min-w-0 overflow-hidden",
              "hover:border-border-strong hover:shadow-sm",
              "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  to="/candidates/$id"
                  params={{ id: c.id as string }}
                  className="text-sm font-semibold text-text-primary truncate block hover:underline"
                >
                  {c.full_name as string}
                </Link>
                {c.current_position ? (
                  <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-text-secondary">
                    <Briefcase className="h-3 w-3 shrink-0 text-text-tertiary" aria-hidden="true" />
                    <span className="truncate">
                      {c.current_position}
                      {c.current_company ? ` @ ${c.current_company}` : ""}
                    </span>
                  </p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Excluir candidato ${c.full_name}`}
                onClick={() => onDelete(c.id as string)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-2 space-y-1 text-xs text-text-tertiary">
              {c.email ? (
                <div className="flex min-w-0 items-center gap-1">
                  <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{c.email as string}</span>
                </div>
              ) : null}
              {c.location ? (
                <div className="flex min-w-0 items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{c.location as string}</span>
                </div>
              ) : null}
            </div>

            {skills.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {skills.slice(0, 6).map((s) => (
                  <MetaPill key={s}>{s}</MetaPill>
                ))}
                {skills.length > 6 ? <MetaPill>+{skills.length - 6}</MetaPill> : null}
              </div>
            ) : null}

            <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
              <CandidateStatusPill status={status} />
              {c.source ? <SourceBadge source={c.source as string} /> : <span />}
            </div>
          </article>
        );
      })}
    </div>
  );
}
