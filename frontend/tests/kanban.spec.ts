import { expect, test, type Page } from "@playwright/test";

const login = async (page: Page) => {
  await page.getByLabel(/username/i).fill("user");
  await page.getByLabel(/password/i).fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
};

test("requires login before showing the kanban board", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /project workspace/i })
  ).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(0);

  await login(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("rejects invalid login credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/username/i).fill("bad");
  await page.getByLabel(/password/i).fill("bad");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(
    page.getByText("Invalid credentials. Use user / password.")
  ).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(0);
});

test("allows logout after successful login", async ({ page }) => {
  await page.goto("/");
  await login(page);

  await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
  await page.getByRole("button", { name: /log out/i }).click();

  await expect(
    page.getByRole("heading", { name: /project workspace/i })
  ).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(0);
});

test("keeps board changes after logout and login", async ({ page }) => {
  await page.goto("/");
  await login(page);
  const cardTitle = `Persistent card ${Date.now()}`;

  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(cardTitle);
  await firstColumn.getByPlaceholder("Details").fill("Should remain after relogin.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText(cardTitle)).toBeVisible();

  await page.getByRole("button", { name: /log out/i }).click();
  await expect(
    page.getByRole("heading", { name: /project workspace/i })
  ).toBeVisible();

  await login(page);
  await expect(firstColumn.getByText(cardTitle)).toBeVisible();
  await page.reload();
  await expect(firstColumn.getByText(cardTitle)).toBeVisible();
});

test("adds a card to a column", async ({ page }) => {
  await page.goto("/");
  await login(page);
  const cardTitle = `Playwright card ${Date.now()}`;
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(cardTitle);
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText(cardTitle)).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await page.goto("/");
  await login(page);
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});
