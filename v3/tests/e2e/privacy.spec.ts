import { expect, test } from "@playwright/test";

test("blocks the external map before optional consent", async ({ context, page }) => {
  await context.clearCookies();
  const external: string[] = [];
  page.on("request", (request) => { if (!request.url().startsWith(test.info().project.use.baseURL ?? "http://127.0.0.1:3000")) external.push(request.url()); });
  await page.goto("/fr/contact");
  await expect(page.getByRole("heading", { name: "Choix de confidentialité" })).toBeVisible();
  expect(external.some((url) => url.includes("google.com/maps"))).toBe(false);
  await page.getByRole("button", { name: "Tout refuser" }).click();
  await expect(page.getByText("La carte externe nécessite votre accord.")).toBeVisible();
  expect(external.some((url) => url.includes("google.com/maps"))).toBe(false);
});
