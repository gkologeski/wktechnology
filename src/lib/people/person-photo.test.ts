import { describe, expect, it } from "vitest";
import {
  PERSON_PHOTO_MAX_BYTES,
  canAutoReplacePhoto,
  isAcceptedPhotoType,
  personInitials,
  photoPath,
} from "./person-photo";

describe("foto de Contato/Lead", () => {
  it("foto do LinkedIn nunca substitui foto manual", () => {
    expect(canAutoReplacePhoto("manual")).toBe(false);
    expect(canAutoReplacePhoto(null)).toBe(true);
    expect(canAutoReplacePhoto("linkedin")).toBe(true);
  });
  it("aceita somente imagens", () => {
    expect(isAcceptedPhotoType("image/jpeg; charset=binary")).toBe(true);
    expect(isAcceptedPhotoType("image/webp")).toBe(true);
    expect(isAcceptedPhotoType("text/html")).toBe(false);
    expect(isAcceptedPhotoType("image/svg+xml")).toBe(false);
    expect(isAcceptedPhotoType(null)).toBe(false);
  });
  it("limite de 2 MB", () => {
    expect(PERSON_PHOTO_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
  it("caminho isolado por workspace e registro", () => {
    expect(photoPath("w1", "contact", "c1")).toBe("w1/contact/c1.webp");
  });
  it("iniciais de até duas palavras", () => {
    expect(personInitials("Kiver Silva Souza")).toBe("KS");
    expect(personInitials("  ")).toBe("?");
  });
});
