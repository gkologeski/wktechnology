import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listImportJourneyEvidence } from "@/lib/projects/imports/import-journey.functions";
import type { JourneyRecordDetail } from "@/lib/projects/imports/import-journey";
import { assertImportUiAccess } from "./import-access";
import type { ImportQueryScope } from "./import-format";
import { useImportAccess } from "./use-import-access";

/** Explicit continuation avoids silently hiding history after a database page limit. */
export function useImportRecordEvidence(
  record: JourneyRecordDetail | undefined,
  scope: ImportQueryScope,
) {
  const access = useImportAccess(scope);
  const load = useServerFn(listImportJourneyEvidence);
  const [olderVersions, setOlderVersions] = useState<JourneyRecordDetail["versions"]>([]);
  const [olderHistory, setOlderHistory] = useState<JourneyRecordDetail["history"]>([]);
  const [versionsCursor, setVersionsCursor] = useState<string | null | undefined>(undefined);
  const [historyCursor, setHistoryCursor] = useState<string | null | undefined>(undefined);
  const generation = useRef("");
  const inFlight = useRef(false);
  generation.current = `${record?.id}:${record?.currentVersionId}:${record?.versionsCursor}:${record?.historyCursor}`;
  useEffect(() => {
    setOlderVersions([]);
    setVersionsCursor(undefined);
  }, [record?.id, record?.currentVersionId, record?.versionsCursor]);
  useEffect(() => {
    setOlderHistory([]);
    setHistoryCursor(undefined);
  }, [record?.id, record?.historyCursor]);
  const nextVersions = versionsCursor === undefined ? record?.versionsCursor : versionsCursor;
  const nextHistory = historyCursor === undefined ? record?.historyCursor : historyCursor;
  const action = useMutation({
    mutationFn: async (kind: "versions" | "history") => {
      assertImportUiAccess(access, record?.provider);
      const cursor = kind === "versions" ? nextVersions : nextHistory;
      if (!record || !cursor) throw new Error("Não há uma página anterior disponível.");
      const owner = generation.current;
      const page = await load({ data: { id: record.id, kind, cursor } });
      return { owner, kind, page };
    },
    onSuccess: ({ owner, kind, page }) => {
      if (owner !== generation.current) return;
      if (kind === "versions") {
        setOlderVersions((rows) => [...rows, ...page.versions]);
        setVersionsCursor(page.nextCursor);
      } else {
        setOlderHistory((rows) => [...rows, ...page.history]);
        setHistoryCursor(page.nextCursor);
      }
    },
    onSettled: () => {
      inFlight.current = false;
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a continuação da evidência.",
      ),
  });
  const versions = [
    ...new Map(
      [...(record?.versions ?? []), ...olderVersions].map((version) => [version.id, version]),
    ).values(),
  ];
  const history = [...(record?.history ?? []), ...olderHistory];
  return {
    versions,
    history,
    nextVersions,
    nextHistory,
    loading: action.isPending,
    loadMore: (kind: "versions" | "history") => {
      if (access.canRead(record?.provider) && !inFlight.current) {
        inFlight.current = true;
        action.mutate(kind);
      }
    },
  };
}
