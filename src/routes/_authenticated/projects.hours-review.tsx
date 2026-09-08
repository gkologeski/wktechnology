// TechProjects — revisão de horas (visão do gestor).
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { IsoDateRangePicker } from "@/components/iso-date-range-picker";
import { HoursReviewPanel } from "@/components/projects/hours-review-panel";

export const Route = createFileRoute("/_authenticated/projects/hours-review")({
  head: () => ({
    meta: [
      { title: "Revisão de Horas — TechProjects" },
      {
        name: "description",
        content: "Aprove, rejeite e acompanhe as horas apontadas pelos profissionais.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HoursReviewPage,
});

function defaultRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12);
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

function HoursReviewPage() {
  const [range, setRange] = useState(defaultRange);

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Revisão de Horas"
        description="Horas apontadas por profissional, projeto e situação."
        actions={
          <IsoDateRangePicker
            from={range.from}
            to={range.to}
            ariaLabel="Período das horas"
            onChange={(r) => setRange({ from: r.from, to: r.to })}
          />
        }
      />
      <HoursReviewPanel from={range.from} to={range.to} />
    </div>
  );
}
