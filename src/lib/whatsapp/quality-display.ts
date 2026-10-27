export type QualityTone = "open" | "onhold" | "closed" | "draft";

/** Rótulo e tom visual da qualidade da linha informada pela Meta. */
export function qualityDisplay(rating: string | null | undefined): {
  label: string;
  tone: QualityTone;
} {
  switch ((rating || "").toUpperCase()) {
    case "GREEN":
      return { label: "Qualidade alta", tone: "open" };
    case "YELLOW":
      return { label: "Qualidade média", tone: "onhold" };
    case "RED":
      return { label: "Qualidade baixa", tone: "closed" };
    default:
      return { label: "Qualidade não avaliada", tone: "draft" };
  }
}
