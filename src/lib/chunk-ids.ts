/** Divide ids em lotes para evitar URLs grandes demais em `.in("id", ...)`. */
export const ID_BATCH_SIZE = 200;

export function chunkIds<T>(ids: T[], size = ID_BATCH_SIZE): T[][] {
  if (size < 1) throw new Error("size deve ser >= 1");
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}
