import { describe, expect, it, vi } from "vitest";
import { uploadAuthorizedNoteAttachment } from "./note-attachments.server";

const USER = "11111111-1111-1111-1111-111111111111";
const input = { name: "Especificação.docx", type: "application/msword", base64: btoa("abc") };

function setup(rpcResult: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const upload = vi.fn().mockResolvedValue({ error: null });
  return { rpc, upload, run: () => uploadAuthorizedNoteAttachment(rpc, { upload }, USER, input) };
}

const denied = (message: string) => ({ data: null, error: { message } });

describe("anexo de nota pelo servidor", () => {
  it("note attachment allows authorized active workspace", async () => {
    const path = `${USER}/ws-1/uuid-Especifica_o.docx`;
    const t = setup({ data: path, error: null });
    await expect(t.run()).resolves.toEqual({ path, size: 3 });
    expect(t.rpc).toHaveBeenCalledWith("shared_storage_upload_path", {
      b: "notes-attachments",
      file_name: input.name,
    });
    expect(t.upload).toHaveBeenCalledWith(path, expect.any(Uint8Array), {
      contentType: input.type,
    });
  });

  it("note attachment denies missing permission before upload", async () => {
    const t = setup(denied("Sem permissão para enviar este anexo."));
    await expect(t.run()).rejects.toThrow("Sem permissão");
    expect(t.upload).not.toHaveBeenCalled();
  });

  it("note attachment respects explicit deny before upload", async () => {
    const t = setup(denied("Sem permissão para enviar este anexo."));
    await expect(t.run()).rejects.toThrow();
    expect(t.upload).not.toHaveBeenCalled();
  });

  it("note attachment rejects path of another user or workspace", async () => {
    const t = setup({ data: "22222222-2222-2222-2222-222222222222/ws-2/x.docx", error: null });
    await expect(t.run()).rejects.toThrow("Caminho de upload inválido.");
    expect(t.upload).not.toHaveBeenCalled();
  });

  it("note attachment rejects inactive membership before upload", async () => {
    const t = setup(denied("Upload inválido."));
    await expect(t.run()).rejects.toThrow("Upload inválido.");
    expect(t.upload).not.toHaveBeenCalled();
  });
});
