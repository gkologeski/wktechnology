import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PrimaryContactResult = {
  hubspotContactId: string | null;
  hubspotCompanyId: string | null;
  hubspotLeadUrl: string | null;
  /** Local contact in our DB (if imported). */
  local: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    mobile_phone: string | null;
    job_title: string | null;
    company_name: string | null;
  } | null;
  /** Live data from HubSpot (only fetched when local is null). */
  hubspot: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    mobilePhone: string | null;
    jobTitle: string | null;
    company: string | null;
  } | null;
  /** When no primary contact id is set on the lead. */
  empty?: boolean;
  /** Set when we tried HubSpot but the call failed. */
  hubspotError?: string;
};

export const getLeadPrimaryContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PrimaryContactResult> => {
    const { supabase } = context;

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("hs_raw, external_ids")
      .eq("id", data.leadId)
      .single();
    if (leadErr) throw new Error(leadErr.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (lead as any)?.hs_raw ?? {};
    const props = raw?.properties ?? {};
    const contactId: string | null =
      props.hs_primary_contact_id?.toString() || null;
    const companyId: string | null =
      props.hs_primary_company_id?.toString() || null;
    const leadObjectId: string | null =
      props.hs_object_id?.toString() ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((lead as any)?.external_ids?.hubspot?.toString() ?? null);

    const hubspotLeadUrl = leadObjectId
      ? `https://app.hubspot.com/contacts/_/record/0-136/${leadObjectId}`
      : null;

    if (!contactId) {
      return {
        hubspotContactId: null,
        hubspotCompanyId: companyId,
        hubspotLeadUrl,
        local: null,
        hubspot: null,
        empty: true,
      };
    }

    // Try local first
    const { data: local } = await supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, email, phone, mobile_phone, job_title, company_name",
      )
      .eq("hs_object_id", contactId)
      .maybeSingle();

    if (local) {
      return {
        hubspotContactId: contactId,
        hubspotCompanyId: companyId,
        hubspotLeadUrl,
        local: local as PrimaryContactResult["local"],
        hubspot: null,
      };
    }

    // Fallback: fetch live from HubSpot via gateway
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
    if (!LOVABLE_API_KEY || !HUBSPOT_API_KEY) {
      return {
        hubspotContactId: contactId,
        hubspotCompanyId: companyId,
        hubspotLeadUrl,
        local: null,
        hubspot: null,
        hubspotError: "HubSpot não conectado",
      };
    }

    try {
      const url =
        `https://connector-gateway.lovable.dev/hubspot/crm/v3/objects/contacts/${contactId}` +
        `?properties=firstname,lastname,email,phone,mobilephone,jobtitle,company`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": HUBSPOT_API_KEY,
        },
      });
      if (!res.ok) {
        return {
          hubspotContactId: contactId,
          hubspotCompanyId: companyId,
          hubspotLeadUrl,
          local: null,
          hubspot: null,
          hubspotError: `HubSpot ${res.status}`,
        };
      }
      const body = (await res.json()) as {
        properties?: Record<string, string | null>;
      };
      const p = body.properties ?? {};
      return {
        hubspotContactId: contactId,
        hubspotCompanyId: companyId,
        hubspotLeadUrl,
        local: null,
        hubspot: {
          firstName: p.firstname ?? null,
          lastName: p.lastname ?? null,
          email: p.email ?? null,
          phone: p.phone ?? null,
          mobilePhone: p.mobilephone ?? null,
          jobTitle: p.jobtitle ?? null,
          company: p.company ?? null,
        },
      };
    } catch (err) {
      return {
        hubspotContactId: contactId,
        hubspotCompanyId: companyId,
        hubspotLeadUrl,
        local: null,
        hubspot: null,
        hubspotError: err instanceof Error ? err.message : String(err),
      };
    }
  });
