import { describe, expect, it } from "vitest";

import { previewPaymentCsv } from "./payment-import";

describe("payment CSV preview", () => {
  it("validates rows, quoted values, duplicates, and invalid dates", () => {
    const preview = previewPaymentCsv([
      "student_reference,period_month,amount,paid_on,note",
      'student-a,2026-09,100,2026-09-05,"Paiement, espèces"',
      "student-a,2026-09,100,2026-09-06,doublon",
      "student-b,2026-13,80,2026-09-05,invalide",
    ].join("\n"));
    expect(preview.valid).toEqual([{ student_reference: "student-a", period_month: "2026-09", amount: 100, paid_on: "2026-09-05", note: "Paiement, espèces", line: 2 }]);
    expect(preview.duplicates).toEqual([{ line: 3, duplicateOf: 2 }]);
    expect(preview.rejected).toEqual([{ line: 4, reason: "period_month" }]);
  });

  it("rejects missing or duplicate headers", () => {
    expect(previewPaymentCsv("student_reference,amount\na,10").rejected[0]?.reason).toBe("invalid_headers");
    expect(previewPaymentCsv("student_reference,period_month,amount,paid_on,amount\na,2026-09,10,2026-09-01,10").rejected[0]?.reason).toBe("invalid_headers");
  });
});
