import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ProductCanvas({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("-m-4 min-h-full bg-product-canvas md:-m-6", className)}>{children}</div>;
}

export function ProductPageHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header className={cn("border-b border-product-divider bg-product-header px-4 py-4 md:px-6", className)}>
      {children}
    </header>
  );
}

export function ProductToolbarBand({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-b border-product-divider bg-product-toolbar px-4 py-3 md:px-6", className)}>
      {children}
    </div>
  );
}

export function ProductTabsBand({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-b border-product-divider bg-product-toolbar px-4 md:px-6", className)}>
      {children}
    </div>
  );
}

export function ProductContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bg-product-canvas p-4 md:p-6", className)}>{children}</div>;
}

export function ProductPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-md border border-product-divider bg-product-panel shadow-xs", className)}>
      {children}
    </section>
  );
}