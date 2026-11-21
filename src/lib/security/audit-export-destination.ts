/** Destino S3 aceito somente como URL pré-assinada https da AWS. */
export function isAwsPresignedUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (host === "amazonaws.com" || host.endsWith(".amazonaws.com")) &&
      (url.searchParams.has("X-Amz-Signature") || url.searchParams.has("Signature"))
    );
  } catch {
    return false;
  }
}

/**
 * Exportações externas de auditoria: webhook exige segredo de assinatura (o receptor
 * comprova origem) e S3 exige URL pré-assinada da AWS. Erros são mensagens ao usuário.
 */
export function assertAuditExportDestination(
  destination: "s3" | "webhook" | "email",
  config: Record<string, unknown>,
  hasNewSecret: boolean,
  isUpdate: boolean,
): void {
  if (destination === "webhook") {
    const url = config["url"];
    if (typeof url !== "string" || !url.startsWith("https://"))
      throw new Error("Informe uma URL https para o webhook.");
    if (!hasNewSecret && !isUpdate)
      throw new Error("Defina um segredo de assinatura para o webhook de auditoria.");
  }
  if (destination === "s3" && !isAwsPresignedUrl(config["presigned_url"]))
    throw new Error("Use uma URL pré-assinada https da AWS S3.");
}
