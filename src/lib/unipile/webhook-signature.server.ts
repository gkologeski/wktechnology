import { createHmac, timingSafeEqual } from "node:crypto";

function unipileSignatureDigest(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest();
}
/** V2 signs timestamp.rawBody. Legacy headers remain explicit compatibility only. */
export function verifyUnipileSignature(
  body: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;
  const match = /^t=(\d+),v0=([a-f\d]{64})$/i.exec(header);
  if (
    !match ||
    !Number.isSafeInteger(Number(match[1])) ||
    Math.abs(nowSeconds - Number(match[1])) > 300
  )
    return false;
  const expected = unipileSignatureDigest(secret, `${match[1]}.${body}`);
  return timingSafeEqual(expected, Buffer.from(match[2], "hex"));
}
