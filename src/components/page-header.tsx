import { type ReactNode } from "react";

export function PageHeader({
  title,
  description,
  count,
  countLabel,
  actions,
}: {
  title: string;
  description?: string;
  count?: number;
  countLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-4 border-b border-product-divider pb-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
        {typeof count === "number" ? (
          <p className="mt-1.5 text-sm tabular-nums text-text-secondary" aria-live="polite">
            {count.toLocaleString("pt-BR")} {countLabel ?? (count === 1 ? "registro" : "registros")}
          </p>
        ) : description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>div]:flex-wrap">
          {actions}
        </div>
      )}
    </header>
  );
}
