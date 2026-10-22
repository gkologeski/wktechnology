import { Link } from "@tanstack/react-router";
import type { PhoneReviewItem } from "@/lib/phone/phone-settings.functions";

/** Nome do registro da fila de revisão, com link para a ficha quando ela existe. */
export function PhoneReviewRecordLink({
  item,
}: {
  item: Pick<PhoneReviewItem, "name" | "route" | "rowId">;
}) {
  if (!item.name) return <span className="text-muted-foreground">Sem nome</span>;
  if (!item.route)
    return (
      <span className="block truncate" title={item.name}>
        {item.name}
      </span>
    );
  return (
    <Link
      to={item.route}
      params={{ id: item.rowId }}
      className="block truncate font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={item.name}
      aria-label={`Abrir ficha de ${item.name}`}
    >
      {item.name}
    </Link>
  );
}
