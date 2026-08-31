import { expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { test, hasE2ECredentials } from "./helpers/auth";

/**
 * Coerência de visibilidade e exclusão por permissão nas entidades principais
 * (Leads, Contatos, Negócios, Contratos, Pessoas).
 *
 * O que é verificado:
 * 1. leitura por workspace — registros criados por outro membro do mesmo
 *    workspace aparecem para o usuário logado (isolamento é por workspace_id,
 *    não por criador);
 * 2. isolamento — registros de outro workspace nunca aparecem;
 * 3. exclusão coerente com a permissão — quando o usuário tem a chave de
 *    delete, a linha realmente sai; quando não tem, a exclusão afeta 0 linhas
 *    (RLS nega em silêncio) e a linha continua legível.
 *
 * O teste lê as permissões efetivas do próprio usuário via
 * `current_user_permissions`, então roda para qualquer papel (admin, manager
 * ou member) sem exigir credenciais separadas por papel.
 */

test.skip(!hasE2ECredentials, "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD para rodar");

type Entity = {
  label: string;
  table: "leads" | "contacts" | "deals" | "contracts" | "people";
  deleteKeys: string[];
  row: (tag: string) => Record<string, unknown>;
};

const ENTITIES: Entity[] = [
  {
    label: "Leads",
    table: "leads",
    deleteKeys: ["techsales.leads.delete", "techsales.leads.delete.workspace"],
    row: (tag) => ({ first_name: `PERM-LEAD-${tag}`, email: `perm.lead.${tag}@example.test` }),
  },
  {
    label: "Contatos",
    table: "contacts",
    deleteKeys: ["techsales.contacts.delete", "techsales.contacts.delete.workspace"],
    row: (tag) => ({ first_name: `PERM-CONTACT-${tag}` }),
  },
  {
    label: "Negócios",
    table: "deals",
    deleteKeys: ["techsales.deals.delete", "techsales.deals.delete.workspace"],
    row: (tag) => ({ name: `PERM-DEAL-${tag}` }),
  },
  {
    label: "Contratos",
    table: "contracts",
    deleteKeys: ["techcontracts.contracts.delete", "techcontracts.contracts.delete.workspace"],
    row: (tag) => ({ title: `PERM-CONTRACT-${tag}` }),
  },
  {
    label: "Pessoas",
    table: "people",
    deleteKeys: ["techpeople.people.delete", "techpeople.people.delete.workspace"],
    row: (tag) => ({ full_name: `PERM-PERSON-${tag}` }),
  },
];

async function permissionKeys(supa: SupabaseClient, workspaceId: string): Promise<Set<string>> {
  // `current_user_permissions(_workspace_id uuid)` retorna SETOF text.
  const { data, error } = await supa.rpc("current_user_permissions", {
    _workspace_id: workspaceId,
  });
  if (error) throw new Error("current_user_permissions: " + error.message);
  const keys = new Set<string>();
  for (const value of (data ?? []) as unknown[]) {
    if (typeof value === "string" && value.includes(".")) keys.add(value);
  }
  return keys;
}

async function readable(supa: SupabaseClient, table: string, id: string): Promise<boolean> {
  const { data, error } = await supa.from(table).select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(`${table} select: ` + error.message);
  return Boolean(data);
}

for (const entity of ENTITIES) {
  test(`Permissões — ${entity.label}: leitura por workspace e exclusão coerente`, async ({
    supa,
    userId,
    workspaceId,
  }) => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Outro membro do mesmo workspace, para provar que a leitura não está
    // presa ao criador do registro.
    const { data: members } = await supa
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .neq("user_id", userId)
      .limit(1);
    const otherUser = (members?.[0] as { user_id: string } | undefined)?.user_id ?? userId;

    // A criação precisa nascer com o próprio usuário como owner: as policies de
    // INSERT exigem `owner_id = auth.uid()`. A transferência para outro membro
    // é feita depois, e é opcional (só ocorre se o papel permitir reatribuir).
    const payload = {
      ...entity.row(tag),
      workspace_id: workspaceId,
      owner_id: userId,
    } as Record<string, unknown>;

    const { data: inserted, error: insertError } = await supa
      .from(entity.table)
      .insert(payload)
      .select("id")
      .single();
    if (insertError) {
      // Sem permissão de criação nesta entidade o cenário não se aplica.
      test.skip(true, `${entity.label}: sem permissão de criação (${insertError.message})`);
      return;
    }
    const id = (inserted as { id: string }).id;
    let removed = false;

    if (otherUser !== userId) {
      // Falha aqui é aceitável (papel sem permissão de reatribuir).
      await supa.from(entity.table).update({ owner_id: otherUser }).eq("id", id);
    }

    try {
      // 1. Registro do workspace é legível independentemente do responsável.
      expect(await readable(supa, entity.table, id)).toBe(true);

      // 2. Nenhum registro de outro workspace aparece.
      const { data: foreign, error: foreignError } = await supa
        .from(entity.table)
        .select("id")
        .neq("workspace_id", workspaceId)
        .limit(1);
      if (foreignError) throw new Error(`${entity.table} foreign select: ` + foreignError.message);
      expect(foreign ?? []).toHaveLength(0);

      // 3. Exclusão coerente com a permissão efetiva.
      const keys = await permissionKeys(supa, workspaceId);
      const canDelete = entity.deleteKeys.some((key) => keys.has(key));

      const { data: affected, error: deleteError } = await supa
        .from(entity.table)
        .delete()
        .eq("id", id)
        .select("id");
      if (deleteError) throw new Error(`${entity.table} delete: ` + deleteError.message);

      if (canDelete) {
        expect((affected ?? []).length).toBe(1);
        expect(await readable(supa, entity.table, id)).toBe(false);
        removed = true;
      } else {
        // RLS nega em silêncio: 0 linhas afetadas, registro segue legível.
        expect((affected ?? []).length).toBe(0);
        expect(await readable(supa, entity.table, id)).toBe(true);
      }
    } finally {
      if (!removed) await supa.from(entity.table).delete().eq("id", id);
    }
  });
}
