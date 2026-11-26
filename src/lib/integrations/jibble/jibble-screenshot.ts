/** Only the provider-owned HTTPS storage documented by Jibble is accepted. */
export function assertJibbleScreenshotUrl(input: string): URL {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443") ||
    !url.hostname.endsWith(".jibble.io") ||
    /^(identity|workspace|time-tracking|time-attendance)\.prod\.jibble\.io$/.test(url.hostname)
  ) {
    throw new Error("O endereço da captura não pertence ao armazenamento autorizado do Jibble.");
  }
  return url;
}

export async function readJibbleScreenshot(
  input: string,
  options: { fetch?: typeof fetch; maxBytes?: number } = {},
) {
  const url = assertJibbleScreenshotUrl(input);
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  const response = await (options.fetch ?? fetch)(url.toString(), {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "image/png,image/jpeg,image/webp" },
  });
  if (!response.ok || !response.body)
    throw new Error("Não foi possível obter o conteúdo da captura.");
  const length = Number(response.headers.get("content-length"));
  if (length > maxBytes)
    throw new Error("Captura excede o limite de transferência; conteúdo pendente.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > maxBytes)
        throw new Error("Captura excede o limite de transferência; conteúdo pendente.");
      chunks.push(item.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let contentType: "image/png" | "image/jpeg" | "image/webp";
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  )
    contentType = "image/png";
  else if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    contentType = "image/jpeg";
  else if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    contentType = "image/webp";
  else throw new Error("O conteúdo fornecido não é uma captura de imagem suportada.");
  return { bytes, contentType };
}
