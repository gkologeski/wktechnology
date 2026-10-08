import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type ProfileStatus } from "@/lib/role-profiles/schema";

const TONE: Record<ProfileStatus, string> = {
  draft: "border-border-subtle text-text-secondary",
  awaiting_info: "border-warning/40 text-warning",
  in_validation: "border-primary/40 text-primary",
  approved: "border-success/40 text-success",
  forwarded: "border-success/40 bg-success/10 text-success",
};

export function RoleProfileStatusBadge({
  status,
  className,
}: {
  status: ProfileStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE[status], className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
