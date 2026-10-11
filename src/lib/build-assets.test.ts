import { expect, it } from "vitest";
import { extractAssetFingerprint } from "./build-assets";
it("recognizes the actual Vite format and detects a changed deployment", () => {
  const before =
    '<script src="/assets/index-BmSiCALz.js"></script><link href="/assets/styles-CpHTLY7V.css">';
  expect(extractAssetFingerprint(before)).toBe(
    "/assets/index-BmSiCALz.js|/assets/styles-CpHTLY7V.css",
  );
  expect(extractAssetFingerprint(before.replace("BmSiCALz", "DZ24nG1V"))).not.toBe(
    extractAssetFingerprint(before),
  );
});
it("ignores normal links and produces a stable deduplicated fingerprint", () => {
  expect(extractAssetFingerprint('<a href="/projects">x</a><img src="/logo.png">')).toBe("");
  const asset = '<script src="/assets/index.BmSiCALz.js"></script>';
  expect(extractAssetFingerprint(asset + asset)).toBe("/assets/index.BmSiCALz.js");
});
