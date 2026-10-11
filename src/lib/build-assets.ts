// Recognizes Vite's name-HASH.js as well as older name.HASH.js references.
export function extractAssetFingerprint(html: string): string {
  const paths = Array.from(
    html.matchAll(
      /(?:src|href)=["'](\/[A-Za-z0-9_./-]+[-.][A-Za-z0-9_-]{6,}\.(?:js|css|mjs))["']/g,
    ),
    (match) => match[1],
  );
  return Array.from(new Set(paths)).sort().join("|");
}
