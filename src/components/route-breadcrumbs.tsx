import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ChevronLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { prettifySegment } from "@/lib/breadcrumb-labels";

export function RouteBreadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Hide on dashboard root
  if (pathname === "/" || pathname === "/dashboard") return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    label: prettifySegment(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  const last = crumbs[crumbs.length - 1];

  return (
    <div className="h-10 flex items-center border-b bg-background/60 backdrop-blur px-6">
      {/* Mobile: back + current */}
      <div className="flex items-center gap-2 sm:hidden text-sm">
        {crumbs.length > 1 && (
          <Link
            to={crumbs[crumbs.length - 2].href as string}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </Link>
        )}
        <span className="text-foreground font-medium truncate">{last.label}</span>
      </div>

      {/* Desktop: full trail */}
      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard" className="inline-flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5" />
                Início
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {crumbs.map((c) => (
            <span key={c.href} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {c.isLast ? (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={c.href as string}>{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
