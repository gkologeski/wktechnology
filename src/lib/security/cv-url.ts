/** A signed storage capability is accepted only on the configured CV bucket. */
export function validatedCvUrl(input: string, storageOrigin: string): URL {
  const target = new URL(input);
  const storage = new URL(storageOrigin);
  const path = decodeURIComponent(target.pathname);
  if (
    target.protocol !== "https:" ||
    target.origin !== storage.origin ||
    target.username ||
    target.password ||
    target.hash ||
    !path.startsWith("/storage/v1/object/sign/ats-cvs/") ||
    path.includes("..") ||
    path.includes("\\") ||
    !target.searchParams.get("token") ||
    path === "/storage/v1/object/sign/ats-cvs/"
  )
    throw new Error("URL do currículo não permitida (envie o PDF pelo botão de upload).");
  return target;
}
