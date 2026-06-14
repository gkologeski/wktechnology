import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type TablePaginationProps = {
  page: number; // 0-indexed
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
  pageSizeOptions?: number[];
  isLoading?: boolean;
  entityLabel?: string;
  className?: string;
};

function buildPageList(current: number, totalPages: number): (number | "...")[] {
  const pages: number[] = [];
  const add = (n: number) => {
    if (!pages.includes(n) && n >= 1 && n <= totalPages) pages.push(n);
  };
  add(1);
  for (let i = current - 2; i <= current + 2; i++) {
    if (i > 1 && i < totalPages) add(i);
  }
  if (totalPages > 1) add(totalPages);
  pages.sort((a, b) => a - b);

  const withDots: (number | "...")[] = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const prev = pages[i - 1];
    if (typeof prev === "number" && p - prev > 1) withDots.push("...");
    withDots.push(p);
  }
  return withDots;
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  isLoading = false,
  entityLabel,
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = page + 1;
  const empty = total === 0;
  const pages = buildPageList(current, totalPages);

  const [jumpValue, setJumpValue] = useState("");
  useEffect(() => {
    setJumpValue("");
  }, [page]);

  const commitJump = () => {
    const n = parseInt(jumpValue, 10);
    if (!Number.isFinite(n)) {
      setJumpValue("");
      return;
    }
    const clamped = Math.min(Math.max(1, n), totalPages);
    if (clamped - 1 !== page) onPageChange(clamped - 1);
    setJumpValue("");
  };

  const fromN = empty ? 0 : page * pageSize + 1;
  const toN = empty ? 0 : Math.min(total, (page + 1) * pageSize);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t bg-card/40 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className,
      )}
    >
      {/* Esquerda — segmented control de pageSize */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Exibir
        </span>
        <div className="inline-flex rounded-lg border bg-muted p-0.5">
          {pageSizeOptions.map((n) => {
            const active = n === pageSize;
            return (
              <button
                key={n}
                type="button"
                disabled={isLoading}
                onClick={() => onPageSizeChange(n)}
                className={cn(
                  "h-7 min-w-[40px] rounded-md px-3 text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  isLoading && "cursor-not-allowed opacity-60",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Centro — contador */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {empty ? (
          <span>0 de 0</span>
        ) : (
          <span>
            Mostrando{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {fromN.toLocaleString("pt-BR")}–{toN.toLocaleString("pt-BR")}
            </span>{" "}
            <span className="opacity-50">/</span>{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {total.toLocaleString("pt-BR")}
            </span>
            {entityLabel ? <> {entityLabel}</> : null}
          </span>
        )}
      </div>

      {/* Direita — navegação numerada + jump */}
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex items-center gap-1" aria-label="Paginação">
          <button
            type="button"
            disabled={isLoading || page <= 0}
            onClick={() => onPageChange(Math.max(0, page - 1))}
            className="group flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </button>

          <div className="flex items-center gap-1">
            {pages.map((p, i) =>
              p === "..." ? (
                <span key={`d${i}`} className="w-6 text-center font-bold text-muted-foreground/60">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  disabled={isLoading}
                  onClick={() => onPageChange(p - 1)}
                  className={cn(
                    "h-8 min-w-8 rounded-lg px-2 text-xs font-semibold tabular-nums transition-colors",
                    p === current
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-current={p === current ? "page" : undefined}
                >
                  {p}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            disabled={isLoading || current >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="group flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </nav>

        {totalPages > 5 ? (
          <div className="hidden items-center gap-2 border-l pl-3 lg:flex">
            <label
              htmlFor="table-pagination-jump"
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Ir para
            </label>
            <input
              id="table-pagination-jump"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={jumpValue}
              placeholder={String(current)}
              disabled={isLoading}
              onChange={(e) => setJumpValue(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitJump();
                }
              }}
              onBlur={commitJump}
              className="h-8 w-12 rounded-lg border bg-background text-center text-xs font-bold text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
