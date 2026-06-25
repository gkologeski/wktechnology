/**
 * TechHire UI — camada global do produto.
 *
 * Esta é a fachada oficial dos componentes presentacionais reutilizáveis em
 * qualquer módulo do TechHire (ATS, futuros módulos). Por enquanto, os
 * componentes globais continuam fisicamente em `src/components/ats/ui/`
 * (origem histórica) e são re-exportados aqui como **fachada estável**.
 *
 * Regras:
 * - Novas telas devem importar de `@/components/techhire/ui` quando o
 *   componente for global. Importações antigas de `@/components/ats/ui`
 *   continuam funcionando (não houve movimentação de arquivos).
 * - Componentes específicos do domínio ATS (StageBadge, ScoreBadge,
 *   SourceBadge, RiskBadge, JobCard, CandidateCard, PipelineColumn) NÃO são
 *   re-exportados aqui — continuam em `@/components/ats/ui` ou no domínio.
 * - Esta camada é puramente presentacional. Proibido importar Supabase,
 *   server functions, queries, mutations ou regras de negócio.
 */

// Layout / containers
export { AtsPageHeader as PageHeader } from "@/components/ats/ui/page-header";
export type { AtsPageHeaderProps as PageHeaderProps } from "@/components/ats/ui/page-header";
export { AtsSectionHeader as SectionHeader } from "@/components/ats/ui/section-header";
export type { AtsSectionHeaderProps as SectionHeaderProps } from "@/components/ats/ui/section-header";

// Métricas / KPIs
export { MetricCard } from "@/components/ats/ui/metric-card";
export type { MetricCardProps, MetricTone } from "@/components/ats/ui/metric-card";

// Estados
export { EmptyState } from "@/components/ats/ui/empty-state";
export type { EmptyStateProps } from "@/components/ats/ui/empty-state";
export {
  Skeletons,
  MetricSkeleton,
  MetricsGridSkeleton,
  CardSkeleton,
  RowSkeleton,
} from "@/components/ats/ui/loading-skeleton";

// Formulários / filtros
export { FilterBar } from "@/components/ats/ui/filter-bar";
export type { FilterBarProps } from "@/components/ats/ui/filter-bar";
export { FormSection } from "@/components/ats/ui/form-section";
export type { FormSectionProps } from "@/components/ats/ui/form-section";

// Badges globais (apenas StatusBadge é genérico de produto)
export { StatusBadge } from "@/components/ats/ui/badges";
export type { JobStatus } from "@/components/ats/ui/badges";

// IA / DEI — reutilizável fora do ATS (insights de produto, dashboards)
export { AIInsightCard } from "@/components/ats/ui/ai-insight-card";
export type { AIInsightCardProps } from "@/components/ats/ui/ai-insight-card";

// Promovidos
export { MetaPill } from "./meta-pill";
export type { MetaPillProps } from "./meta-pill";
