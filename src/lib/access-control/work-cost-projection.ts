import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
const safe = {
  contracts:
    "id,workspace_id,owner_id,role,counterparty_company_id,deal_id,parent_contract_id,number,title,status,starts_at,ends_at,auto_renew,notice_days,total_value,currency,readjustment_index,readjustment_period,payment_terms,body_html,signed_at,signed_pdf_path,metadata,created_at,updated_at,monthly_value,hours_per_month,payment_day,payment_method,late_fee_percent,late_interest_monthly_percent,expense_reimbursement_days,penalty_percent,cure_period_days,trial_period_days,unilateral_termination_notice_days,service_type,service_scope,service_location,governing_law,jurisdiction,confidentiality_term_months,contracting_legal_entity_id,signature_provider,signature_document_id,signature_operation_id,source_file_path,imported_from,import_confidence,assigned_to,document_kind,amendment_of_id,amendment_number,amendment_effective_at,proposal_id,quote_id",
  projects:
    "id,workspace_id,owner_id,service_id,contract_id,role,name,description,status,starts_at,due_at,progress,planned_hours,metadata,created_at,updated_at,assigned_to,company_id,deal_id,delivery_group_key,source_line_item_id,client_contact_id,origin,delivery_template_version_id,delivery_template_applied_at,delivery_template_applied_by,client_acceptance_required",
  project_members:
    "id,workspace_id,project_id,user_id,role_in_project,created_at,updated_at,can_track_time",
} as const;
const privateFields = {
  contracts: ["public_token"],
  projects: ["planned_cost"],
  project_members: ["cost_rate_hour", "bill_rate_hour"],
} as const;
/** User-client query adapter. Raw cost columns are revoked in Postgres. Hydration
 * uses a batched RPC that independently checks active tenant, row scope and cost
 * permission. It never applies to privileged background/service clients. */
export function workCostTable<T extends keyof typeof safe>(db: SupabaseClient<Database>, table: T) {
  const base = db.from(table);
  let hydrate = false;
  let injectedId = false;
  const wrap = (target: object): object =>
    new Proxy(target, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (key === "select")
          return (selection = "*", ...options: unknown[]) => {
            const tokens = selection.split(/,(?![^()]*\))/).map((x: string) => x.trim());
            hydrate = tokens.includes("*") || privateFields[table].some((f) => tokens.includes(f));
            if (hydrate) {
              injectedId = !tokens.includes("*") && !tokens.includes("id");
              selection = tokens
                .flatMap((f: string) =>
                  f === "*"
                    ? safe[table].split(",")
                    : privateFields[table].some((p) => p === f)
                      ? []
                      : [f],
                )
                .join(",");
              if (injectedId) selection = "id," + selection;
            }
            return wrap(Reflect.apply(value, target, [selection, ...options]));
          };
        if (key === "then")
          return (
            fulfilled: ((result: unknown) => unknown) | undefined,
            rejected: ((error: unknown) => unknown) | undefined,
          ) => {
            const promise = Promise.resolve<Record<string, unknown>>(
              Reflect.apply(value, target, [(result: Record<string, unknown>) => result]),
            );
            return promise
              .then(async (result: Record<string, unknown>) => {
                if (!hydrate || result.error || !result.data) return result;
                const list = Array.isArray(result.data) ? result.data : [result.data];
                const ids = list
                  .map((r: Record<string, unknown>) => r.id)
                  .filter((id: unknown): id is string => typeof id === "string");
                if (!ids.length) return result;
                const { data, error } = await (
                  db.rpc as unknown as (
                    name: string,
                    args: Record<string, unknown>,
                  ) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>
                )("work_cost_projection", {
                  r:
                    table === "projects"
                      ? "techprojects.projects"
                      : table === "contracts"
                        ? "techcontracts.contracts"
                        : "techprojects.members",
                  ids,
                });
                if (error) return { ...result, data: null, error };
                const byId = new Map((data ?? []).map((r) => [r.id, r]));
                const rows = list.map((row: Record<string, unknown>) => {
                  const projected = {
                    ...row,
                    ...Object.fromEntries(privateFields[table].map((k) => [k, null])),
                    ...byId.get(row.id),
                  };
                  if (injectedId) delete projected.id;
                  return projected;
                });
                return { ...result, data: Array.isArray(result.data) ? rows : rows[0] };
              })
              .then(fulfilled, rejected);
          };
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const result = Reflect.apply(value, target, args);
          return result && typeof result === "object" ? wrap(result) : result;
        };
      },
    });
  return wrap(base) as typeof base;
}
