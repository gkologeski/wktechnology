/**
 * SQL de UM lote de aplicação/rollback de uma execução de telefones
 * (`phone_normalization_items`). Uma instrução só (CTEs), para rodar por
 * psql com papel de escrita ou pela ferramenta de dados.
 *
 * Garantias do lote:
 * - Grava só quando o valor atual ainda é o original da prévia; senão marca
 *   `changed_since_dry_run` e não toca no registro.
 * - Sempre filtra pelo workspace da execução (exceto `profiles`, que não tem
 *   workspace e só entra quando o usuário é exclusivo do workspace).
 * - Ramal: só preenche `phone_ext` vazio; nunca apaga ramal existente.
 * - Automações/histórico suprimidos pelo token estreito (`crm_is_derivation_backfill`).
 * - Idempotente: item aplicado não entra de novo; repetir dá 0.
 * - Resolve na fila da execução-mãe só o item do mesmo campo/registro com o
 *   MESMO valor original e só quando este lote gravou.
 *
 * Uso: bun batch-sql.ts apply|rollback <run> <parent|-> <ws> <tabela> <coluna> [lote]
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TABLES: Record<string, string[]> = {
  contacts: ["phone", "mobile_phone"],
  leads: ["phone", "mobile_phone"],
  companies: ["phone"],
  people: ["phone", "emergency_phone"],
  prospecting_results: ["phone", "company_phone"],
  ats_candidates: ["phone"],
  ats_referrals: ["candidate_phone"],
  bookings: ["invitee_phone"],
  profiles: ["phone"],
};
const EXT_TABLES = new Set(["contacts", "leads", "companies"]);
export const APPLY_CLASSES = [
  "safe_explicit",
  "safe_record_country",
  "placeholder",
  "blank_short",
] as const;
export const BACKFILL_TOKEN = "wk-phone-e164-v1";

function check(run: string, parent: string | null, ws: string, table: string, col: string) {
  if (!UUID.test(run) || !UUID.test(ws) || (parent !== null && !UUID.test(parent)))
    throw new Error("uuid inválido");
  if (!TABLES[table]?.includes(col)) throw new Error(`campo fora do inventário: ${table}.${col}`);
}

export function applyBatchSql(o: {
  run: string;
  parent: string | null;
  ws: string;
  table: string;
  col: string;
  batch?: number;
}): string {
  const { run, parent, ws, table, col } = o;
  check(run, parent, ws, table, col);
  const batch = Math.max(1, Math.min(5000, Math.floor(o.batch ?? 2000)));
  const wsFilter = table === "profiles" ? "" : `and x.workspace_id = '${ws}'`;
  const extSet =
    EXT_TABLES.has(table) && col === "phone"
      ? ", phone_ext = coalesce(x.phone_ext, b.proposed_ext)"
      : "";
  const classes = APPLY_CLASSES.map((c) => `'${c}'`).join(",");
  const resolve = parent
    ? `,
res as (
  update public.phone_normalization_items o
     set resolved_at = now(), resolved_run_id = '${run}', resolution = n.classification
    from public.phone_normalization_items n
   where n.id in (select id from upd)
     and o.run_id = '${parent}' and o.workspace_id = '${ws}'
     and o.table_name = n.table_name and o.column_name = n.column_name and o.row_id = n.row_id
     and o.original_value is not distinct from n.original_value
     and o.applied_at is null and o.resolved_at is null
  returning 1)`
    : `,
res as (select 1 where false)`;
  return `with cfg as materialized (
  select set_config('app.phone_e164_backfill', '${BACKFILL_TOKEN}', true) as v),
batch as materialized (
  select i.id, i.row_id, i.proposed_value, i.proposed_ext, i.original_value
    from public.phone_normalization_items i, cfg
   where cfg.v = '${BACKFILL_TOKEN}'
     and i.run_id = '${run}' and i.workspace_id = '${ws}'
     and i.table_name = '${table}' and i.column_name = '${col}'
     and i.applied_at is null and i.classification in (${classes})
   order by i.id limit ${batch}
   for update of i skip locked),
upd as (
  update public.${table} x set ${col} = b.proposed_value${extSet}
    from batch b
   where x.id = b.row_id ${wsFilter}
     and x.${col} is not distinct from b.original_value
  returning b.id),
mark as (
  update public.phone_normalization_items i
     set applied_at = case when i.id in (select id from upd) then now() end,
         classification = case when i.id in (select id from upd) then i.classification
                               else 'changed_since_dry_run' end
   where i.id in (select id from batch)
  returning 1)${resolve}
select (select count(*) from batch) as lote, (select count(*) from upd) as gravados,
       (select count(*) from mark) as marcados, (select count(*) from res) as resolvidos_na_fila`;
}

export function rollbackBatchSql(o: {
  run: string;
  ws: string;
  table: string;
  col: string;
  batch?: number;
}): string {
  const { run, ws, table, col } = o;
  check(run, null, ws, table, col);
  const batch = Math.max(1, Math.min(5000, Math.floor(o.batch ?? 2000)));
  const wsFilter = table === "profiles" ? "" : `and x.workspace_id = '${ws}'`;
  const extSet =
    EXT_TABLES.has(table) && col === "phone"
      ? ", phone_ext = case when b.proposed_ext is not null and x.phone_ext is not distinct from b.proposed_ext then null else x.phone_ext end"
      : "";
  return `with cfg as materialized (
  select set_config('app.phone_e164_backfill', '${BACKFILL_TOKEN}', true) as v),
batch as materialized (
  select i.id, i.row_id, i.proposed_value, i.proposed_ext, i.original_value,
         i.table_name, i.column_name
    from public.phone_normalization_items i, cfg
   where cfg.v = '${BACKFILL_TOKEN}'
     and i.run_id = '${run}' and i.workspace_id = '${ws}'
     and i.table_name = '${table}' and i.column_name = '${col}'
     and i.applied_at is not null and i.rolled_back_at is null
   order by i.id limit ${batch}
   for update of i skip locked),
upd as (
  update public.${table} x set ${col} = b.original_value${extSet}
    from batch b
   where x.id = b.row_id ${wsFilter}
     and x.${col} is not distinct from b.proposed_value
  returning b.id, b.row_id),
mark as (
  update public.phone_normalization_items i
     set rolled_back_at = now(),
         reason = case when i.id in (select id from upd) then i.reason
                       else coalesce(i.reason, '') || ' | não restaurado: alterado depois' end
   where i.id in (select id from batch)
  returning 1),
reopen as (
  update public.phone_normalization_items o
     set resolved_at = null, resolved_run_id = null, resolution = null
   where o.resolved_run_id = '${run}' and o.workspace_id = '${ws}'
     and o.table_name = '${table}' and o.column_name = '${col}'
     and o.row_id in (select row_id from upd)
  returning 1)
select (select count(*) from batch) as lote, (select count(*) from upd) as restaurados,
       (select count(*) from reopen) as reabertos_na_fila`;
}

if (import.meta.main) {
  const [, , mode, run, parent, ws, table, col, batch] = process.argv;
  const sql =
    mode === "apply"
      ? applyBatchSql({
          run,
          parent: parent === "-" ? null : parent,
          ws,
          table,
          col,
          batch: batch ? Number(batch) : undefined,
        })
      : mode === "rollback"
        ? rollbackBatchSql({ run, ws, table, col, batch: batch ? Number(batch) : undefined })
        : null;
  if (!sql) throw new Error("modo: apply|rollback");
  console.log(sql + ";");
}
