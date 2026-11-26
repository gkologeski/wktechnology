import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { ImportProvider, ImportJson } from "./import-journey";

export type ImportPreservationInput = {
  workspaceId: string;
  provider: ImportProvider;
  sourceId: string;
  runId: string;
  records: Array<{
    entity: string;
    externalId?: string | null;
    payload: unknown;
    status?: "received" | "pending" | "ready";
    issues?: string[];
    sourcePersonId?: string | null;
    observationKey?: string;
  }>;
};

const secretKey =
  /^(?:authorization|proxy.?authorization|cookie|set.?cookie|password|passwd|api.?key|access.?token|refresh.?token|id.?token|client.?secret|signing.?secret|private.?key|key.?ciphertext|credentials.?ciphertext)$/i;
const secretParam =
  /^(?:token|access_token|refresh_token|api_key|apikey|signature|sig|key|jwt|expires|x-amz-.+|x-goog-.+)$/i;

/** Keep business values intact; credentials and temporary URL capabilities are not business history. */
export function sanitizeImportPayload(value: unknown): ImportJson {
  if (Array.isArray(value)) return value.map(sanitizeImportPayload);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !secretKey.test(key))
        .map(([key, item]) => [key, sanitizeImportPayload(item)]),
    );
  }
  if (typeof value === "string") {
    return value.replace(/https?:\/\/[^\s<>"')\]]+/gi, (address) => {
      try {
        const url = new URL(address.replace(/&amp;/g, "&"));
        let modified = !!url.username || !!url.password;
        let fragment = url.hash;
        try {
          fragment = decodeURIComponent(fragment);
        } catch {
          /* Keep malformed anchors as data. */
        }
        if (
          /(?:^|[?#&])(?:access_token|refresh_token|id_token|token|api_key|signature|jwt)=/i.test(
            fragment,
          )
        ) {
          url.hash = "";
          modified = true;
        }
        url.username = "";
        url.password = "";
        for (const key of [...url.searchParams.keys()])
          if (secretParam.test(key)) {
            url.searchParams.delete(key);
            modified = true;
          }
        if (!modified) return address;
        const safe = url.toString();
        return address.includes("&amp;") ? safe.replace(/&/g, "&amp;") : safe;
      } catch {
        return address;
      }
    });
  }
  return typeof value === "number" || typeof value === "boolean" ? value : null;
}

export function canonicalImportJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalImportJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalImportJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value ?? null);
}
const hash = (value: unknown) =>
  createHash("sha256").update(canonicalImportJson(value)).digest("hex");

export function prepareImportRecords(records: ImportPreservationInput["records"]) {
  const occurrences = new Map<string, number>();
  return records.map((record) => {
    const payload = sanitizeImportPayload(record.payload);
    const payloadHash = hash(payload);
    const externalId = record.externalId?.trim() ? record.externalId : null;
    const missing = !externalId;
    const occurrenceKey = `${record.entity}:${payloadHash}`;
    const occurrence = occurrences.get(occurrenceKey) ?? 0;
    occurrences.set(occurrenceKey, occurrence + 1);
    const id =
      externalId || `missing:${hash(record.observationKey || `${payloadHash}:${occurrence}`)}`;
    return {
      entity: record.entity,
      external_id: id,
      payload,
      payload_hash: payloadHash,
      status: missing ? "pending" : (record.status ?? "received"),
      issues: [...new Set([...(record.issues ?? []), ...(missing ? ["missing_external_id"] : [])])],
      source_person_id: record.sourcePersonId ?? null,
    };
  });
}

/** User and service callers both revalidate provider/run/actor/tenant in the RPC. */
export async function preserveImportRecords(
  db: SupabaseClient,
  input: ImportPreservationInput,
): Promise<void> {
  const rows = prepareImportRecords(input.records);
  for (let index = 0; index < rows.length; index += 100) {
    try {
      await workRpc(db, "project_import_preserve_records", {
        p_workspace: input.workspaceId,
        p_provider: input.provider,
        p_source: input.sourceId,
        p_run: input.runId,
        p_records: rows.slice(index, index + 100),
      });
    } catch (error) {
      throw new Error(
        `Não foi possível preservar os registros recebidos: ${error instanceof Error ? error.message : "falha de armazenamento"}`,
      );
    }
  }
}
