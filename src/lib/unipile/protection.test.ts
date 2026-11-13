import { expect, it } from "vitest";
import { unipileProtection } from "./protection";
it("honors Retry-After seconds", () =>
  expect(unipileProtection(429, "120", 0)?.until).toBe(new Date(120000).toISOString()));
it("honors Retry-After HTTP dates", () =>
  expect(unipileProtection(429, new Date(120000).toUTCString(), 0)?.until).toBe(
    new Date(120000).toISOString(),
  ));
it("pauses quota failure without header", () =>
  expect(unipileProtection(429, null, 0)?.until).toBe(new Date(3600000).toISOString()));
it("requires reconnection after invalid credentials", () =>
  expect(unipileProtection(401, null, 0)?.disconnected).toBe(true));
it("pauses restrictions instead of retrying", () =>
  expect(unipileProtection(422, null, 0)?.reason).toBe("provider_restriction"));
it("does not pause a successful response", () =>
  expect(unipileProtection(200, null, 0)).toBeNull());

it("never shortens a provider pause longer than one day", () =>
  expect(unipileProtection(429, "172800", 0)?.until).toBe(new Date(172800000).toISOString()));
