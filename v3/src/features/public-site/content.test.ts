import { describe, expect, it } from "vitest";

import { publicPages, replacementForLegacyPublicPage } from "./content";

describe("public site navigation", () => {
  it("exposes only the four approved destinations", () => {
    expect(publicPages).toEqual(["home", "programs", "schedule", "replays"]);
  });

  it("keeps old public URLs useful through stable replacements", () => {
    expect(replacementForLegacyPublicPage("about")).toBe("home");
    expect(replacementForLegacyPublicPage("courses")).toBe("programs");
    expect(replacementForLegacyPublicPage("registration")).toBe("schedule");
    expect(replacementForLegacyPublicPage("contact")).toBe("schedule");
    expect(replacementForLegacyPublicPage("replays")).toBeNull();
  });
});
