import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getSalesPublicToken } from "./sales-sharing.functions";
import { getPublicAppUrl } from "@/lib/app-url";
/** Resolve a private token only when the user explicitly shares/downloads. */
export function useSalesSharing(table: "quotes" | "proposals") {
  const get = useServerFn(getSalesPublicToken);
  const token = (id: string) => get({ data: { table, id } });
  const url = async (id: string) =>
    `${getPublicAppUrl()}/${table === "quotes" ? "quote" : "proposal"}/${await token(id)}`;
  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(await url(id));
      toast.success("Link copiado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const open = async (id: string, pdf = false) => {
    const tab = window.open("about:blank", "_blank");
    try {
      const t = await token(id);
      const target = pdf
        ? `${getPublicAppUrl()}/api/public/${table}/${t}/pdf`
        : `${getPublicAppUrl()}/${table === "quotes" ? "quote" : "proposal"}/${t}`;
      if (tab) {
        tab.opener = null;
        tab.location.href = target;
      } else window.location.assign(target);
    } catch (e) {
      tab?.close();
      toast.error((e as Error).message);
    }
  };
  return { token, url, copy, open };
}
