import { describe, expect, it } from "vitest";
import { normalizeContact } from "./normalize-contact";

describe("contact normalization", () => {
  it("normalizes a Moroccan local mobile number to E.164", () => expect(normalizeContact("phone", "06 12 34 56 78")).toEqual({ normalized: "+212612345678", countryCode: "MA" }));
  it("normalizes email casing and spaces", () => expect(normalizeContact("email", " USER@Example.COM ")).toEqual({ normalized: "user@example.com", countryCode: "" }));
  it("rejects invalid destinations", () => { expect(() => normalizeContact("phone", "123")).toThrow(); expect(() => normalizeContact("email", "not-an-email")).toThrow(); });
});
