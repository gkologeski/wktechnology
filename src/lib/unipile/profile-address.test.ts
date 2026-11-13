import { expect, it } from "vitest";
import { linkedinProfileIdentifier } from "./profile-address";
it("accepts public personal profiles, Unicode identifiers and tracking queries", () => {
  expect(
    linkedinProfileIdentifier("https://www.linkedin.com/in/andressa-wolf-31491090/?trk=test"),
  ).toBe("andressa-wolf-31491090");
  expect(linkedinProfileIdentifier("https://linkedin.com/in/jo%C3%A3o")).toBe("joão");
});
it("rejects credentials, other hosts, protocols and non-person URLs", () => {
  for (const value of [
    "http://linkedin.com/in/a",
    "https://linkedin.com.evil/in/a",
    "https://user:pass@linkedin.com/in/a",
    "https://linkedin.com/company/a",
    "https://localhost/in/a",
    "https://linkedin.com/in/a%2Fb",
    "https://linkedin.com/in/a/posts",
    null,
  ])
    expect(linkedinProfileIdentifier(value)).toBeNull();
});
