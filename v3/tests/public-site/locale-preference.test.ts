import { describe, expect, it } from "vitest";

import { resolvePublicLocale, toPublicLocale } from "@/features/public-site/locale-preference";

describe("public locale preference", () => {
  it.each([
    [["fr-FR"], undefined, "fr"],
    [["ar-MA"], undefined, "ar"],
    [["en-US"], undefined, "en"],
    [["zgh-MA"], undefined, "amz"],
    [["es-ES", "fr-MA", "ar-MA"], undefined, "fr"],
    [["es-ES", "de-DE"], undefined, "fr"],
    [["ar-MA"], "fr", "fr"],
  ])("resolves %j with saved %s", (languages, saved, expected) => {
    expect(resolvePublicLocale(languages, saved)).toBe(expected);
  });

  it("recognises the existing Amazigh locale and codes", () => {
    expect(toPublicLocale("amz")).toBe("amz");
    expect(toPublicLocale("shi-MA")).toBe("amz");
  });
});
