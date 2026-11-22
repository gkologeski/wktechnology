/** Token-free orchestration. The store owns authorization, durable receipts and cursor CAS. */
export type GmailProvenance = "incremental" | "seed" | "expired_history";
export type GmailHistoryPage = {
  history?: Array<{ messagesAdded?: Array<{ message: { id: string } }> }>;
  historyId?: string;
  nextPageToken?: string;
};
export type GmailDiscovery = { ids: string[]; nextHistory: string; provenance: GmailProvenance };
export type GmailQueueItem = {
  id: string;
  provider_message_id: string;
  provenance: GmailProvenance;
  preexisting: boolean;
};
export type GmailOutcome = "inserted" | "existing" | "skipped" | "gone";

export async function collectGmailHistory(
  request: (pageToken?: string) => Promise<GmailHistoryPage>,
): Promise<{ ids: string[]; nextHistory: string | null }> {
  const ids = new Set<string>();
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;
  let nextHistory: string | null = null;
  do {
    const page = await request(pageToken);
    for (const history of page.history ?? []) {
      for (const added of history.messagesAdded ?? []) ids.add(added.message.id);
    }
    if (page.historyId) nextHistory = page.historyId;
    pageToken = page.nextPageToken;
    if (pageToken && seenTokens.has(pageToken))
      throw new Error("Paginação Gmail repetida; cursor preservado.");
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken);
  return { ids: [...ids], nextHistory };
}

export async function discoverGmailBatch(
  currentHistory: string | null,
  api: {
    profile: () => Promise<string>;
    recent: () => Promise<string[]>;
    history: (cursor: string) => Promise<{ ids: string[]; nextHistory: string | null }>;
  },
): Promise<GmailDiscovery> {
  if (currentHistory) {
    try {
      const page = await api.history(currentHistory);
      return {
        ids: page.ids,
        nextHistory: page.nextHistory ?? currentHistory,
        provenance: "incremental",
      };
    } catch (error) {
      const value = error as { status?: number; message?: string };
      if (
        !(
          value.status === 404 ||
          value.status === 410 ||
          (value.status === 400 && /failedPrecondition/i.test(value.message ?? ""))
        )
      )
        throw error;
    }
  }
  // Capture the boundary BEFORE seed retrieval: arrivals during seed remain in the next history range.
  const nextHistory = await api.profile();
  return {
    ids: await api.recent(),
    nextHistory,
    provenance: currentHistory ? "expired_history" : "seed",
  };
}

export async function drainGmailQueue(
  items: readonly GmailQueueItem[],
  worker: {
    persist: (item: GmailQueueItem) => Promise<GmailOutcome>;
    finish: (item: GmailQueueItem, outcome: GmailOutcome) => Promise<boolean>;
    retry: (item: GmailQueueItem) => Promise<boolean>;
  },
) {
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const outcome = await worker.persist(item);
      if (!(await worker.finish(item, outcome))) throw new Error("Reserva Gmail substituída.");
      if (outcome === "inserted") inserted++;
      else skipped++;
    } catch {
      failed++;
      // Failure to release is also durable: the lease expires and another worker can reclaim it.
      await worker.retry(item).catch(() => false);
    }
  }
  return { fetched: items.length, inserted, skipped, failed };
}
