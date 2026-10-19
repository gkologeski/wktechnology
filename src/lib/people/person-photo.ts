/** Regras compartilhadas (navegador e servidor) da foto de Contatos e Leads. */
export const PERSON_PHOTO_BUCKET = "contact-photos";
export const PERSON_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PERSON_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export type PersonEntity = "contact" | "lead";
export type PhotoSource = "manual" | "linkedin";

export function photoPath(workspaceId: string, entity: PersonEntity, id: string, ext = "webp") {
  return `${workspaceId}/${entity}/${id}.${ext}`;
}

export function isAcceptedPhotoType(type: string | null | undefined) {
  return !!type && (PERSON_PHOTO_TYPES as readonly string[]).includes(type.split(";")[0].trim());
}

/** Foto automática (LinkedIn) nunca substitui uma foto enviada manualmente. */
export function canAutoReplacePhoto(currentSource: string | null | undefined) {
  return !currentSource || currentSource === "linkedin";
}

/** Iniciais de até duas palavras; "?" quando não há letras. */
export function personInitials(name: string | null | undefined) {
  const parts = (name ?? "")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return out || "?";
}

export function personPhotoKey(entity: PersonEntity, id: string) {
  return `${entity}:${id}`;
}
