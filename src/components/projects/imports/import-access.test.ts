import { expect, it } from "vitest";
import {
  assertImportUiAccess,
  canManageImportContext,
  canManageImportSource,
  canReadImportContext,
  importPermissionFingerprint,
  type ImportAccessContext,
} from "./import-access";
const keys = new Set([
  "techprojects.clockify_import.view.workspace",
  "techprojects.clockify_import.manage.workspace",
]);
const context = (patch: Partial<ImportAccessContext> = {}): ImportAccessContext => ({
  actorId: "actor",
  workspaceId: "workspace",
  scope: ["actor", "workspace", importPermissionFingerprint(keys)],
  permissions: keys,
  ready: true,
  readOnly: false,
  ...patch,
});

const access = (value: ImportAccessContext) => ({
  canRead: (provider?: Parameters<typeof canReadImportContext>[1]) =>
    canReadImportContext(value, provider),
  canManage: (provider: Parameters<typeof canManageImportContext>[1]) =>
    canManageImportContext(value, provider),
});
it("allows the active matching context with the effective source key", () => {
  expect(() => assertImportUiAccess(access(context()), "clockify", true)).not.toThrow();
  expect(canReadImportContext(context(), "clockify")).toBe(true);
  expect(canManageImportContext(context(), "clockify")).toBe(true);
  expect(canReadImportContext(context(), "jibble")).toBe(false);
});
it("denies a context without the source key even with another import permission", () => {
  const permissions = new Set(["techprojects.jibble_import.view.workspace"]);
  expect(() => assertImportUiAccess(access(context({ permissions })), "clockify", true)).toThrow();
  expect(
    canReadImportContext(
      context({
        permissions,
        scope: ["actor", "workspace", importPermissionFingerprint(permissions)],
      }),
      "clockify",
    ),
  ).toBe(false);
});
it("effective deny cannot be bypassed by stale source metadata", () => {
  const permissions = new Set<string>();
  const denied = context({ permissions });
  expect(() => assertImportUiAccess(access(denied), "clockify", true)).toThrow();
  expect(canManageImportContext(denied, "clockify")).toBe(false);
  expect(canReadImportContext(denied, "clockify")).toBe(false);
});
it("rejects a foreign workspace and actor rather than reusing cached context", () => {
  expect(() =>
    assertImportUiAccess(access(context({ workspaceId: "foreign" })), "clockify", true),
  ).toThrow();
  expect(canReadImportContext(context({ workspaceId: "foreign" }), "clockify")).toBe(false);
  expect(canManageImportContext(context({ actorId: "another" }), "clockify")).toBe(false);
});
it("rejects inactive membership and unresolved permission state", () => {
  expect(() =>
    assertImportUiAccess(access(context({ workspaceId: null })), "clockify", true),
  ).toThrow();
  expect(
    canReadImportContext(context({ workspaceId: null, permissions: new Set() }), "clockify"),
  ).toBe(false);
  expect(canManageImportContext(context({ ready: false }), "clockify")).toBe(false);
});
it("readonly and missing read access block management", () => {
  expect(canManageImportContext(context({ readOnly: true }), "clockify")).toBe(false);
  const permissions = new Set(["techprojects.clockify_import.manage.workspace"]);
  expect(
    canManageImportContext(
      context({
        permissions,
        scope: ["actor", "workspace", importPermissionFingerprint(permissions)],
      }),
      "clockify",
    ),
  ).toBe(false);
});
it("source callback eligibility requires verified source and management", () => {
  const source = { canView: true, canManage: true, ready: true } as Parameters<
    typeof canManageImportSource
  >[0];
  expect(canManageImportSource(source, false)).toBe(true);
  expect(canManageImportSource({ ...source, ready: false }, false)).toBe(false);
  expect(canManageImportSource({ ...source, canManage: false }, false)).toBe(false);
  expect(canManageImportSource(source, true)).toBe(false);
});
