import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
import { assertWorkRecord } from "@/lib/access-control/work-core.server";

// Contratar fornecedor (PJ) ou profissional (PF) a partir de um contrato de venda.
export const createPurchaseFromSale = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contracts", "create")])
  .inputValidator((d) =>
    z
      .object({
        saleContractId: z.string().uuid(),
        counterpartyKind: z.enum(["company", "person"]),
        companyId: z.string().uuid().nullable().optional(),
        contactId: z.string().uuid().nullable().optional(),
        title: z.string().max(300).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertWorkRecord(
      context.supabase,
      "techcontracts.contracts",
      data.saleContractId,
      "view",
    );
    const { purchaseFromSale } = await import("./purchase-from-sale.server");
    return purchaseFromSale(context.supabase, context.userId, data);
  });

// Busca de contraparte (empresa ou contato) sob RLS do usuário, no workspace ativo.
export const searchPurchaseCounterparty = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contracts", "create")])
  .inputValidator((d) =>
    z
      .object({
        entity: z.enum(["company", "contact", "sale"]),
        search: z.string().max(120),
        companyId: z.string().uuid().nullable().optional(),
        selected: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const term = data.search.trim().replace(/[%,()]/g, " ");
    if (data.entity === "sale") {
      let q = context.supabase
        .from("contracts")
        .select("id,title,number,status")
        .eq("workspace_id", ws)
        .eq("role", "provider")
        .eq("document_kind", "main");
      if (data.selected) q = q.eq("id", data.selected);
      else if (term) q = q.or(`title.ilike.%${term}%,number.ilike.%${term}%`);
      const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(20);
      if (error) throw new Error(error.message);
      return (
        (rows ?? []) as {
          id: string;
          title: string | null;
          number: string | null;
          status: string;
        }[]
      ).map((r) => ({
        id: r.id,
        label: r.title ?? r.number ?? "Contrato de venda",
        hint: r.number ?? "Sem número",
      }));
    }
    if (data.entity === "company") {
      let q = context.supabase.from("companies").select("id,name,cnpj").eq("workspace_id", ws);
      q = data.selected
        ? q.eq("id", data.selected)
        : q.or(`name.ilike.%${term}%,cnpj.ilike.%${term}%`);
      const { data: rows, error } = await q.order("name").limit(20);
      if (error) throw new Error(error.message);
      return ((rows ?? []) as { id: string; name: string | null; cnpj: string | null }[]).map(
        (r) => ({
          id: r.id,
          label: r.name ?? "Empresa sem nome",
          hint: r.cnpj ? `CNPJ ${r.cnpj}` : "Sem CNPJ",
        }),
      );
    }
    let q = context.supabase
      .from("contacts")
      .select("id,first_name,last_name,email,company_id")
      .eq("workspace_id", ws);
    if (data.companyId) q = q.eq("company_id", data.companyId);
    q = data.selected
      ? q.eq("id", data.selected)
      : term
        ? q.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
        : q;
    const { data: rows, error } = await q.order("first_name").limit(20);
    if (error) throw new Error(error.message);
    return (
      (rows ?? []) as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      }[]
    ).map((r) => ({
      id: r.id,
      label: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "Contato",
      hint: r.email ?? "Sem e-mail",
    }));
  });

// Preenche o rascunho de compra com um modelo de Compra publicado.
export const fillPurchaseContractBody = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contracts", "update")])
  .inputValidator((d) =>
    z.object({ contractId: z.string().uuid(), templateId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertWorkRecord(context.supabase, "techcontracts.contracts", data.contractId, "update");
    const { fillPurchaseBody } = await import("./purchase-from-sale.server");
    return fillPurchaseBody(context.supabase, context.userId, data);
  });

export const listPurchaseContractTemplates = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contracts", "update")])
  .handler(async ({ context }) => {
    const { listPurchaseTemplates } = await import("./purchase-from-sale.server");
    return listPurchaseTemplates(context.supabase, context.userId);
  });
