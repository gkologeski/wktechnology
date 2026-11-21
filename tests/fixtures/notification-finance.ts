import { readFileSync } from "node:fs";
import type postgres from "postgres";
import { loadNotificationBusinessFunction as load } from "./notification-business-events";

const core = "supabase/migrations/20260717211414_32331c68-c891-4539-b3ba-e4275edd87c5.sql";
const allocations = "supabase/migrations/20260719131529_0d23b95a-8c9c-4a66-afde-bf6f40fda6bb.sql";

function statement(file: string, prefix: string) {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf(prefix);
  if (start < 0) throw Error(`Missing canonical Finance DDL: ${file}::${prefix}`);
  return source.slice(start, source.indexOf(";", start) + 1);
}

/** Real payment derivation, caller/RLS guards and private fiscal registration. No provider or authorization stubs. */
export async function setupNotificationFinance(db: postgres.Sql) {
  for (const type of [
    "financial_direction",
    "financial_origin_type",
    "financial_entry_status",
    "financial_category_kind",
  ])
    await db.unsafe(statement(core, `CREATE TYPE public.${type} `));
  await db.unsafe(`
    ALTER TABLE public.people ADD COLUMN cnpj text;
    ALTER TABLE public.contacts ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
    ALTER TABLE public.financial_entries ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ALTER COLUMN status TYPE public.financial_entry_status USING status::public.financial_entry_status,
      ADD COLUMN direction public.financial_direction,ADD COLUMN origin_type public.financial_origin_type DEFAULT 'manual',
      ADD COLUMN origin_id uuid,ADD COLUMN contract_id uuid,ADD COLUMN service_id uuid,
      ADD COLUMN counterparty_company_id uuid,ADD COLUMN counterparty_legal_entity_id uuid,
      ADD COLUMN category_id uuid,ADD COLUMN cost_center_id uuid,ADD COLUMN legal_entity_id uuid,ADD COLUMN bank_account_id uuid,
      ADD COLUMN description text,ADD COLUMN amount numeric(14,2),ADD COLUMN currency text DEFAULT 'BRL',
      ADD COLUMN competence_date date,ADD COLUMN due_date date,ADD COLUMN paid_amount numeric(14,2) DEFAULT 0,
      ADD COLUMN payment_method text,ADD COLUMN notes text,ADD COLUMN attachments jsonb DEFAULT '[]',
      ADD COLUMN external_ref text,ADD COLUMN metadata jsonb DEFAULT '{}',ADD COLUMN parent_entry_id uuid,
      ADD COLUMN installment_number integer,ADD COLUMN installment_total integer,
      ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now();
  `);
  for (const [file, table] of [
    [core, "financial_categories"],
    [core, "financial_bank_accounts"],
    [core, "financial_payments"],
    [allocations, "financial_cost_centers"],
    [allocations, "financial_entry_allocations"],
  ])
    await db.unsafe(statement(file, `CREATE TABLE public.${table} (`));
  await db.unsafe(`
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.financial_entries,public.financial_payments,public.financial_categories,public.financial_bank_accounts,public.financial_cost_centers,public.financial_entry_allocations TO authenticated;
    GRANT ALL ON public.financial_entries,public.financial_payments,public.financial_categories,public.financial_bank_accounts,public.financial_cost_centers,public.financial_entry_allocations TO service_role;
    ALTER TABLE public.financial_payments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.financial_bank_accounts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.financial_cost_centers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.financial_entry_allocations ENABLE ROW LEVEL SECURITY;
    CREATE INDEX financial_payments_entry_idx ON public.financial_payments(entry_id);
    CREATE INDEX financial_entries_due_date_idx ON public.financial_entries(due_date);
  `);
  for (const name of [
    "finance_scope_access",
    "finance_context_payment_access",
    "finance_payment_access",
    "finance_lock_payment_entry",
    "finance_entry_capabilities",
  ])
    await load(db, "drizzle/migrations/0210_finance_core_actions.sql", name);
  for (const name of ["recalc_financial_entry", "financial_payments_after_change"])
    await load(db, core, name);
  await db.unsafe(statement(core, "CREATE TRIGGER financial_payments_recalc"));
  await db.unsafe(`
    REVOKE ALL ON FUNCTION public.recalc_financial_entry(uuid),public.financial_payments_after_change() FROM PUBLIC,anon,authenticated;
    REVOKE ALL ON FUNCTION public.finance_scope_access(uuid,text,text,uuid),public.finance_context_payment_access(jsonb,uuid,uuid,text),public.finance_payment_access(uuid,text),public.finance_lock_payment_entry(uuid,text),public.finance_entry_capabilities(uuid[]) FROM PUBLIC,anon;
    GRANT EXECUTE ON FUNCTION public.finance_scope_access(uuid,text,text,uuid),public.finance_context_payment_access(jsonb,uuid,uuid,text),public.finance_payment_access(uuid,text),public.finance_lock_payment_entry(uuid,text),public.finance_entry_capabilities(uuid[]) TO authenticated;
  `);
  const activation = readFileSync("drizzle/migrations/0211_finance_core_activation.sql", "utf8");
  const firstReload = "NOTIFY pgrst,'reload schema';";
  await db.unsafe(activation.slice(0, activation.indexOf(firstReload) + firstReload.length));
  for (const [table, resource] of [
    ["financial_categories", "categories"],
    ["financial_bank_accounts", "bank_accounts"],
    ["financial_cost_centers", "cost_centers"],
  ])
    await db.unsafe(
      `CREATE POLICY finance_view ON public.${table} FOR SELECT TO authenticated USING(public.finance_context_access((SELECT public.finance_access_context()),workspace_id,'${resource}','view',NULL))`,
    );
  await db.unsafe(
    `CREATE POLICY finance_view ON public.financial_entry_allocations FOR SELECT TO authenticated USING(public.finance_entry_access(entry_id,'view'))`,
  );

  // The existing P10 fixture already loads real approval/formalization/start.
  // Fiscal operations extend it with their canonical private tables and bucket.
  await db.unsafe(`
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    ALTER TABLE storage.objects ADD COLUMN metadata jsonb;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO authenticated;
    GRANT SELECT,INSERT ON storage.objects TO authenticated;
  `);
  await db.unsafe(
    readFileSync("drizzle/migrations/0382_hiring_execution_deliveries_fiscal.sql", "utf8"),
  );
  await db.unsafe(readFileSync("drizzle/migrations/0400_notification_finance.sql", "utf8"));
}
