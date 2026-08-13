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
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight text-primary">{title}</h1>
        {typeof count === "number" ? (
          <p className="text-sm text-muted-foreground mt-1 tabular-nums">
            {count.toLocaleString("pt-BR")} {countLabel ?? (count === 1 ? "registro" : "registros")}
          </p>
        ) : description ? (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        ) : null}
      </div>
      {actions && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>div]:flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
