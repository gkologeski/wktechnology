import { ChevronDown } from "lucide-react";
import type { JourneySource } from "@/lib/projects/imports/import-journey";
import { count, PROVIDER_LABEL } from "./import-format";
import { ProviderIcon } from "./import-journey-ui";

export function FlowHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7 max-w-3xl">
      <h2
        className="mb-2 text-xl font-semibold tracking-tight sm:text-2xl"
        tabIndex={-1}
        data-journey-heading
      >
        {title}
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export function FlowFooter({ note, children }: { note: string; children: React.ReactNode }) {
  return (
    <div className="mt-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{note}</p>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        {children}
      </div>
    </div>
  );
}

export function CoverageSource({ source }: { source: JourneySource }) {
  return (
    <details className="group py-4">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ProviderIcon provider={source.provider} />
        <span className="flex-1 text-sm font-medium">
          {PROVIDER_LABEL[source.provider]}
          <small className="mt-1 block text-xs font-normal text-muted-foreground">
            {source.coverage.length} {source.coverage.length === 1 ? "tipo" : "tipos"} de registro
          </small>
        </span>
        <ChevronDown
          className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <ul className="ml-13 mt-3 space-y-2.5">
        {source.coverage.map((item) => (
          <li
            key={item.entity}
            className="flex flex-wrap items-start justify-between gap-2 text-xs"
          >
            <span>
              <span className="font-medium">{item.label}</span>
              {item.reason && (
                <span className="mt-0.5 block max-w-xl text-muted-foreground">{item.reason}</span>
              )}
            </span>
            <span className="text-muted-foreground">
              {item.status === "available"
                ? item.count == null
                  ? "A contar na leitura"
                  : `${count(item.count)} já recebidos`
                : item.status === "unavailable"
                  ? "Cobertura indisponível"
                  : item.status === "not_collected"
                    ? "Ainda não coletado"
                    : "A verificar"}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="px-3 first:pl-0 sm:px-6">
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block text-2xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">
          {count(value)}
        </span>
        <span
          aria-hidden
          className="mt-2 block text-xs leading-relaxed text-text-secondary sm:text-sm"
        >
          {label}
        </span>
        <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground sm:text-xs">
          {hint}
        </span>
      </dd>
    </div>
  );
}
