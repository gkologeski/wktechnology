// Etapa "companies" da importação do HubSpot — extraída de hubspot-steps.server.ts
import {
  type HSRec,
  batchRead,
  discoverTotal,
  hsFetch,
  loadHsProperties,
  mapCompany,
  rawOf,
} from "./hubspot-api.server";
import { appendLog, patchItemBefore } from "./hubspot-steps-state.server";
import { upsertByHsId } from "./hubspot-steps-upsert.server";
import type { StepRunArgs } from "./hubspot-step-run-context";
import type { StepResult } from "./hubspot-steps-types";

export async function runCompaniesStep(args: StepRunArgs): Promise<StepResult | void> {
  const {
    supabase,
    userId,
    workspaceId,
    jobId,
    itemId,
    step,
    scope,
    resume,
    st,
    deadlineAt,
    isExpired,
    bump,
    persistCursor,
  } = args;
  const allProps = await loadHsProperties("companies");
  const propsParam = allProps.length
    ? allProps.join(",")
    : "name,domain,industry,numberofemployees,phone,city,state,zip,address,website";

  // Delta mode: target_ids pre-injetados (reconciliação). Pula pagination/search e faz batchRead direto.
  if (Array.isArray(resume.target_ids) && resume.discovery_complete) {
    const targetIds = resume.target_ids;
    const propsList = allProps.length
      ? allProps
      : [
          "name",
          "domain",
          "industry",
          "numberofemployees",
          "phone",
          "city",
          "state",
          "zip",
          "address",
          "website",
        ];
    let idx = (resume.read_index as number) ?? 0;
    const CHUNK = 100;
    while (idx < targetIds.length) {
      if (isExpired()) {
        st.partial = true;
        break;
      }
      const chunkIds = targetIds.slice(idx, idx + CHUNK);
      const recs = await batchRead("companies", chunkIds, propsList);
      for (const c of recs) {
        const p = c.properties;
        if (!p.name) {
          st.fail++;
          continue;
        }
        const mapped = mapCompany(p);
        const payload = {
          owner_id: userId,
          name: p.name,
          domain: p.domain ?? null,
          industry: p.industry ?? null,
          size: p.numberofemployees ?? null,
          phone: p.phone ?? null,
          city: p.city ?? null,
          state: p.state ?? null,
          cep: p.zip ?? null,
          address: p.address ?? null,
          website: p.website ?? null,
          ...mapped,
          external_ids: { hubspot: c.id } as never,
          hs_raw: rawOf(c),
          deleted_at: null,
        };
        const r = await upsertByHsId(supabase, "companies", userId, c.id, payload);
        if (r.status === "failed") st.fail++;
        else {
          st.imported.push(c.id);
          st.ok++;
        }
      }
      idx += chunkIds.length;
      await persistCursor({ read_index: idx });
      await bump(st.ok, st.fail, targetIds.length);
    }
    if (st.partial) await persistCursor({ read_index: idx });
  } else {
    const alreadyProcessed = st.ok + st.fail;
    let after: string | undefined =
      resume.cursor ?? (alreadyProcessed > 0 ? String(alreadyProcessed) : undefined);
    let page = Math.floor(alreadyProcessed / 100) + 1;
    // Descobre o total real no HubSpot apenas na primeira execução do step
    if (resume.discovered === undefined) {
      const total = await discoverTotal("companies");
      if (total !== null) {
        const effective = Math.min(total, scope.maxCompanies);
        await patchItemBefore(supabase, itemId, { discovered: effective });
        await appendLog(supabase, jobId, {
          level: "info",
          step,
          message: `Total no HubSpot: ${total} · alvo desta execução: ${effective}`,
        });
      }
    }
    while (st.ok + st.fail < scope.maxCompanies) {
      if (isExpired()) {
        st.partial = true;
        await persistCursor({
          cursor: after ?? (st.ok + st.fail > 0 ? String(st.ok + st.fail) : undefined),
        });
        break;
      }
      const remaining = scope.maxCompanies - (st.ok + st.fail);
      const limit = Math.min(100, remaining);
      const params: Record<string, string> = { limit: String(limit), properties: propsParam };
      if (after) params.after = after;
      const res = (await hsFetch("/crm/v3/objects/companies", params)) as {
        results: (HSRec & { createdAt?: string; updatedAt?: string })[];
        paging?: { next?: { after: string } };
      };
      if (!res.results.length) break;
      await appendLog(supabase, jobId, {
        level: "info",
        step,
        message: `Página ${page}: ${res.results.length} empresas`,
        count: res.results.length,
      });
      type Task = { hsId: string; name: string; payload: Record<string, unknown> };
      const tasks: Task[] = [];
      for (const c of res.results) {
        const p = c.properties;
        if (!p.name) continue;
        const mapped = mapCompany(p);
        tasks.push({
          hsId: c.id,
          name: p.name as string,
          payload: {
            owner_id: userId,
            name: p.name,
            domain: p.domain ?? null,
            industry: p.industry ?? null,
            size: p.numberofemployees ?? null,
            phone: p.phone ?? null,
            city: p.city ?? null,
            state: p.state ?? null,
            cep: p.zip ?? null,
            address: p.address ?? null,
            website: p.website ?? null,
            ...mapped,
            external_ids: { hubspot: c.id } as never,
            hs_raw: rawOf(c),
          },
        });
      }

      // Conta como falha os registros sem nome
      st.fail += res.results.length - tasks.length;

      const CONCURRENCY = 12;
      for (let i = 0; i < tasks.length; i += CONCURRENCY) {
        const batch = tasks.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map((t) => upsertByHsId(supabase, "companies", userId, t.hsId, t.payload)),
        );
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status === "failed") {
            st.fail++;
            await appendLog(supabase, jobId, {
              level: "warn",
              step,
              message: `Falha empresa ${batch[j].name}: ${r.error}`,
            });
          } else {
            st.imported.push(batch[j].hsId);
            st.ok++;
          }
        }
        await bump(st.ok, st.fail);
      }
      after = res.paging?.next?.after;
      await persistCursor({ cursor: after ?? null, last_processed: st.ok + st.fail });
      await bump(st.ok, st.fail);
      page++;
      if (!after) break;
    }
    await patchItemBefore(supabase, itemId, { discovered: st.ok + st.fail });
  }
}
