/** Only public personal LinkedIn profile identifiers; never an arbitrary URL fetch. */
export function linkedinProfileIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["linkedin.com", "www.linkedin.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    const match = url.pathname.match(/^\/in\/([^/]+)\/?$/);
    if (!match) return null;
    const id = decodeURIComponent(match[1]);
    return /^[\p{L}\p{N}_.-]{1,200}$/u.test(id) ? id : null;
  } catch {
    return null;
  }
}
