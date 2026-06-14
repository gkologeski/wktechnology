import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useEntitlements } from "@/lib/use-entitlements";
import { PLAN_LABELS, type EntKey, type PlanCode } from "@/lib/entitlements";
import type { ReactNode } from "react";

interface FeatureGateProps {
  feature: EntKey | string;
  /** Plano mínimo recomendado para destravar (usado no fallback). */
  requiredPlan?: PlanCode;
  /** Conteúdo renderizado quando o usuário tem acesso. */
  children: ReactNode;
  /** Conteúdo customizado quando bloqueado (default: UpgradeCard). */
  fallback?: ReactNode;
  /** Se true, renderiza children com overlay desabilitado em vez de fallback. */
  blurred?: boolean;
}

export function FeatureGate({
  feature,
  requiredPlan,
  children,
  fallback,
  blurred,
}: FeatureGateProps) {
  const ent = useEntitlements();
  if (ent.loading) return null;
  if (ent.isEnabled(feature) && ent.can(feature)) return <>{children}</>;
  if (blurred) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none opacity-40 blur-[1px]">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <UpgradeCard feature={feature} requiredPlan={requiredPlan} />
        </div>
      </div>
    );
  }
  return <>{fallback ?? <UpgradeCard feature={feature} requiredPlan={requiredPlan} />}</>;
}

export function UpgradeCard({
  feature,
  requiredPlan = "prata",
  title,
  description,
}: {
  feature?: EntKey | string;
  requiredPlan?: PlanCode;
  title?: string;
  description?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">
            {title ?? `Disponível no plano ${PLAN_LABELS[requiredPlan]}`}
          </CardTitle>
        </div>
        <CardDescription>
          {description ??
            (feature
              ? `Este recurso (${feature}) faz parte de um plano superior.`
              : "Este recurso faz parte de um plano superior.")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/settings/billing">Ver planos</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

interface LimitBadgeProps {
  feature: EntKey | string;
  label?: string;
  showProgress?: boolean;
}

export function LimitBadge({ feature, label, showProgress }: LimitBadgeProps) {
  const ent = useEntitlements();
  if (ent.loading) return null;
  const info = ent.info(feature);
  if (!info.enabled) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Lock className="h-3 w-3" /> {label ?? "Bloqueado"}
      </Badge>
    );
  }
  if (info.limit === null) {
    return <Badge variant="outline">{label ? `${label}: ` : ""}Ilimitado</Badge>;
  }
  const pct = info.limit > 0 ? Math.min(100, (info.used / info.limit) * 100) : 0;
  const variant: "secondary" | "destructive" | "default" =
    pct >= 100 ? "destructive" : pct >= 80 ? "default" : "secondary";

  return (
    <div className="inline-flex flex-col gap-1">
      <Badge variant={variant}>
        {label ? `${label}: ` : ""}
        {info.used.toLocaleString("pt-BR")} / {info.limit.toLocaleString("pt-BR")}
      </Badge>
      {showProgress && <Progress value={pct} className="h-1 w-32" />}
    </div>
  );
}
