import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { autoLogoUrls, logoDomain } from "@/lib/domain-utils";
import { colorFromString } from "@/components/crm/hubspot-shell";

const SIZES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-lg",
} as const;

type Props = {
  name: string | null | undefined;
  seed: string;
  logoUrl?: string | null;
  domain?: string | null;
  website?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * Logotipo da empresa em cascata: logo manual → Clearbit → Google Favicon → iniciais.
 * Falhas de carregamento avançam para a próxima fonte sem quebrar o layout.
 */
export function CompanyAvatar({
  name,
  seed,
  logoUrl,
  domain,
  website,
  size = "md",
  className,
}: Props) {
  const sources = useMemo(() => {
    const list: string[] = [];
    if (logoUrl?.trim()) list.push(logoUrl.trim());
    list.push(...autoLogoUrls(logoDomain(domain, website)));
    return list;
  }, [logoUrl, domain, website]);

  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [sources]);

  const src = sources[index];
  const label = name?.trim() || "Empresa";
  const initials = label.slice(0, 2).toUpperCase();

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-card",
        SIZES[size],
        className,
      )}
      title={label}
    >
      {!loaded && (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center font-semibold text-primary-foreground"
          style={{ background: colorFromString(seed) }}
        >
          {initials}
        </span>
      )}
      {src && (
        <img
          key={src}
          src={src}
          alt={`Logotipo de ${label}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn(
            "relative h-full w-full object-contain p-0.5 transition-opacity duration-200 motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={(e) => {
            // Favicon genérico do Google costuma ter 16px: tratar como ausente.
            const img = e.currentTarget;
            if (img.naturalWidth > 0 && img.naturalWidth <= 16 && index < sources.length - 1) {
              setIndex((i) => i + 1);
              return;
            }
            if (img.naturalWidth <= 16) return; // mantém iniciais
            setLoaded(true);
          }}
          onError={() => {
            setLoaded(false);
            setIndex((i) => i + 1);
          }}
        />
      )}
      {!loaded && <span className="sr-only">{label}</span>}
    </span>
  );
}
