// Upload de PDF de CV: faz upload pro bucket ats-cvs, extrai texto via pdfjs-dist
// no browser e retorna {url, text} pra chamar parseCv.
import { useRef, useState } from "react";
import { FolderOpen, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileCenterPickerDialog } from "@/components/files/file-center-picker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  onExtracted: (args: { text: string; cvUrl: string | null }) => void;
  disabled?: boolean;
};

export function CvPdfUploadButton({ onExtracted, disabled }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      // 1) extrai texto com pdfjs-dist
      let text = "";
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")).default;
        (pdfjs as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
          workerUrl;
        const buf = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        const parts: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const tc = await page.getTextContent();
          parts.push(
            (tc.items as Array<{ str?: string }>)
              .map((it) => (typeof it.str === "string" ? it.str : ""))
              .join(" "),
          );
        }
        text = parts.join("\n").replace(/\s+/g, " ").trim();
      } catch (e) {
        console.error("pdfjs error", e);
        toast.error("Falha ao extrair texto do PDF. Você pode colar o texto manualmente.");
      }

      // 2) upload pro bucket privado
      let cvUrl: string | null = null;
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (!uid) throw new Error("Não autenticado");
        const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("ats-cvs")
          .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("ats-cvs")
          .createSignedUrl(path, 60 * 60 * 24 * 30); // 30d
        cvUrl = signed?.signedUrl ?? null;
      } catch (e) {
        console.error("upload error", e);
        toast.error("Falha ao enviar o PDF para armazenamento.");
      }

      onExtracted({ text, cvUrl });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => ref.current?.click()}
        disabled={busy || disabled}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        {busy ? "Processando…" : "Enviar PDF"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setPickerOpen(true)}
        disabled={busy || disabled}
      >
        <FolderOpen className="h-4 w-4 mr-2" /> Centro de Arquivos
      </Button>
      <FileCenterPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple={false}
        onPicked={async (files) => {
          if (files[0]) await handle(files[0]);
        }}
      />
    </>
  );
}
