import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  paths: string[];
  className?: string;
};

export function BugReportImages({ paths, className }: Props) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!paths || paths.length === 0) {
        setUrls([]);
        return;
      }
      const { data, error } = await supabase.storage
        .from("bug-reports")
        .createSignedUrls(paths, 60 * 60);
      if (cancelled) return;
      if (error || !data) {
        setUrls([]);
        return;
      }
      setUrls(data.map((d) => d.signedUrl).filter(Boolean) as string[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [paths]);

  if (!paths || paths.length === 0) return null;

  return (
    <div className={`grid grid-cols-3 gap-2 sm:grid-cols-4 ${className ?? ""}`}>
      {urls.map((u, i) => (
        <a
          key={u}
          href={u}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded border bg-muted"
        >
          <img
            src={u}
            alt={`Anexo ${i + 1}`}
            className="h-24 w-full object-cover hover:opacity-90 transition"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}
