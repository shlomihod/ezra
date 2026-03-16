import { test, expect } from "@playwright/test";

async function createDocument(page: import("@playwright/test").Page, title: string) {
  const res = await page.request.post("/api/documents", {
    data: { title },
  });
  expect(res.ok()).toBeTruthy();
  const doc = await res.json();
  return doc.id as string;
}

test("app loads and editor renders", async ({ page }) => {
  const docId = await createDocument(page, "Test Doc");
  await page.goto(`/#/${docId}`);
  const editor = page.locator(".tiptap, .ProseMirror, [contenteditable]");
  await expect(editor.first()).toBeVisible({ timeout: 10000 });
});

test("can type text in editor", async ({ page }) => {
  const docId = await createDocument(page, "Type Test");
  await page.goto(`/#/${docId}`);
  const editor = page.locator(".tiptap, .ProseMirror, [contenteditable]");
  await expect(editor.first()).toBeVisible({ timeout: 10000 });
  await editor.first().click();
  await page.keyboard.type("Hello from Playwright");
  await expect(editor.first()).toContainText("Hello from Playwright");
});
