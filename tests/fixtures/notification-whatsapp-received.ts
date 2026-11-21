import { readFileSync } from "node:fs";
import type postgres from "postgres";

/** Missing physical shapes only. The message SELECT policy is copied verbatim
 * from the canonical migration; every producer/proof/worker executes 0405. */
export async function setupNotificationWhatsAppReceived(db: postgres.Sql) {
  const [reference] =
    await db`select 'public.sales_event_reference_access(text,uuid)'::regprocedure::oid::text oid`;
  await db.unsafe(`
    ALTER TABLE public.whatsapp_messages ADD COLUMN owner_id uuid,
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp();
    ALTER TABLE public.whatsapp_webhook_events ADD COLUMN received_at timestamptz NOT NULL DEFAULT clock_timestamp();
    ALTER TABLE public.whatsapp_conversations ADD COLUMN contact_phone text;
    CREATE TABLE public.wa_business_accounts(id uuid PRIMARY KEY,workspace_id uuid REFERENCES workspaces(id),waba_id text,status text NOT NULL DEFAULT 'connected');
    CREATE TABLE public.wa_phone_numbers(id uuid PRIMARY KEY,workspace_id uuid REFERENCES workspaces(id),waba_id uuid REFERENCES wa_business_accounts(id),phone_number_id text,display_phone_number text);
    ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.whatsapp_messages TO authenticated;
  `);
  const canonical = readFileSync("drizzle/migrations/0223_order4_sales_activate.sql", "utf8");
  const line = canonical
    .split("\n")
    .find((x) => x.startsWith('CREATE POLICY sales_view ON public."whatsapp_messages"'));
  if (!line) throw Error("Missing canonical WhatsApp message SELECT policy");
  await db.unsafe(line);
  await db.unsafe(readFileSync("drizzle/migrations/0405_workflow_whatsapp_received.sql", "utf8"));
  const [after] =
    await db`select 'public.sales_event_reference_access(text,uuid)'::regprocedure::oid::text oid`;
  if (reference.oid !== after.oid)
    throw Error("WhatsApp migration detached the event reference RLS policy dependencies");
}
