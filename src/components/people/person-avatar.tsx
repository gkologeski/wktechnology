import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorFromString } from "@/components/crm/hubspot-shell";
import { personInitials } from "@/lib/people/person-photo";

/**
 * Avatar padrão de pessoa: foto quando houver, senão iniciais com cor fixa pela semente.
 * O tamanho vem de `className` (ex.: "h-9 w-9 text-xs").
 */
export function PersonAvatar({
  name,
  seed,
  photoUrl,
  className,
}: {
  name: string | null | undefined;
  seed: string;
  photoUrl?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoUrl]);
  const initials = personInitials(name);
  const show = !!photoUrl && !failed;
  return (
    <span
      className={cn(
        "relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-primary-foreground",
        className,
      )}
      style={show ? undefined : { background: colorFromString(seed) }}
      title={name ?? undefined}
    >
      {show ? (
        <img
          src={photoUrl!}
          alt={name ? `Foto de ${name}` : "Foto"}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : initials === "?" ? (
        <User className="h-1/2 w-1/2" aria-hidden />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}
