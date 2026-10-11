import { afterEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { observeQueries, measureRequest } from "./browser";
afterEach(() => vi.restoreAllMocks());
it("measures a real query cycle once, with a safe family only", async () => {
  const client = new QueryClient();
  const measure = vi.spyOn(performance, "measure");
  const off = observeQueries(client);
  await client.fetchQuery({
    queryKey: ["projects", "private-id"],
    queryFn: async () => "private data",
  });
  expect(measure).toHaveBeenCalledTimes(1);
  expect(measure.mock.calls[0][0]).toBe("techerp:query:projects:success");
  off();
  client.clear();
});

it("records failed requests and preserves their error", async () => {
  const measure = vi.spyOn(performance, "measure");
  const error = new Error("private message");
  await expect(
    measureRequest(["ats-jobs", "private-id"], async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(measure.mock.calls[0][0]).toBe("techerp:query:hire:error");
});
