import { z } from "zod";

const paymentRowSchema = z.object({
  student_reference: z.string().trim().min(1).max(160),
  period_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amount: z.coerce.number().finite().min(0).max(1_000_000),
  paid_on: z.string().date(),
  note: z.string().trim().max(1000).default(""),
});

export type PaymentImportRow = z.infer<typeof paymentRowSchema>;
export type PaymentImportPreview = {
  valid: Array<PaymentImportRow & { line: number }>;
  rejected: Array<{ line: number; reason: string }>;
  duplicates: Array<{ line: number; duplicateOf: number }>;
};

const requiredHeaders = ["student_reference", "period_month", "amount", "paid_on"] as const;

export function previewPaymentCsv(source: string): PaymentImportPreview {
  const rows = parseCsv(source.replace(/^\uFEFF/, ""));
  if (!rows.length) return { valid: [], rejected: [{ line: 1, reason: "empty_file" }], duplicates: [] };
  const headers = rows[0]?.map((value) => value.trim().toLowerCase()) ?? [];
  if (new Set(headers).size !== headers.length || requiredHeaders.some((header) => !headers.includes(header))) {
    return { valid: [], rejected: [{ line: 1, reason: "invalid_headers" }], duplicates: [] };
  }

  const valid: PaymentImportPreview["valid"] = [];
  const rejected: PaymentImportPreview["rejected"] = [];
  const duplicates: PaymentImportPreview["duplicates"] = [];
  const firstOccurrence = new Map<string, number>();
  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index] ?? [];
    const line = index + 1;
    if (values.every((value) => !value.trim())) continue;
    if (values.length !== headers.length) {
      rejected.push({ line, reason: "column_count_mismatch" });
      continue;
    }
    const raw = Object.fromEntries(headers.map((header, position) => [header, values[position] ?? ""]));
    const parsed = paymentRowSchema.safeParse(raw);
    if (!parsed.success) {
      rejected.push({ line, reason: parsed.error.issues[0]?.path.join(".") || "invalid_row" });
      continue;
    }
    const key = `${parsed.data.student_reference.toLocaleLowerCase()}|${parsed.data.period_month}`;
    const duplicateOf = firstOccurrence.get(key);
    if (duplicateOf) {
      duplicates.push({ line, duplicateOf });
      continue;
    }
    firstOccurrence.set(key, line);
    valid.push({ ...parsed.data, line });
  }
  return { valid, rejected, duplicates };
}

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  if (quoted) throw new Error("unterminated_quote");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}
