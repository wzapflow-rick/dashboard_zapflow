# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bugs-regression.test.ts >> Bug Fixes - Regression Tests >> product names should be readable in dark mode
- Location: tests\bugs-regression.test.ts:22:9

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-testid="product-name"]').first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - img [ref=e4]
    - heading "Cardápio não encontrado" [level=1] [ref=e9]
    - paragraph [ref=e10]: O link pode estar incorreto ou a loja não existe.
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e16] [cursor=pointer]:
    - img [ref=e17]
  - alert [ref=e20]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Bug Fixes - Regression Tests', () => {
  4  | 
  5  |     // BUG #1: Tutorial Overflow
  6  |     test('tutorial should fit in mobile viewport', async ({ page }) => {
  7  |         await page.setViewportSize({ width: 375, height: 667 });
  8  |         await page.goto('/register');
  9  | 
  10 |         const modal = page.locator('[data-testid="tutorial-modal"]');
  11 |         const button = page.locator('[data-testid="next-button"]');
  12 | 
  13 |         const boundingBox = await button.boundingBox();
  14 |         const viewportSize = page.viewportSize();
  15 | 
  16 |         if (boundingBox && viewportSize) {
  17 |             expect(boundingBox.y + boundingBox.height).toBeLessThan(viewportSize.height);
  18 |         }
  19 |     });
  20 | 
  21 |     // BUG #2: Dark Mode Menu
  22 |     test('product names should be readable in dark mode', async ({ page }) => {
  23 |         await page.goto('/menu/test');
  24 |         await page.evaluate(() => document.documentElement.classList.add('dark'));
  25 | 
  26 |         const productName = page.locator('[data-testid="product-name"]').first();
> 27 |         const color = await productName.evaluate(el =>
     |                                         ^ Error: locator.evaluate: Test timeout of 30000ms exceeded.
  28 |             window.getComputedStyle(el).color
  29 |         );
  30 | 
  31 |         // rgb(255, 255, 255) ou similar (claro)
  32 |         expect(color).toMatch(/rgb\(2[0-5][0-9],\s*2[0-5][0-9],\s*2[0-5][0-9]\)/);
  33 |     });
  34 | 
  35 |     // BUG #3: Image Upload Error
  36 |     test('should show specific error for large image', async ({ page }) => {
  37 |         await page.goto('/dashboard/products');
  38 |         await page.click('button:has-text("Novo Produto")');
  39 | 
  40 |         const input = page.locator('input[type="file"]');
  41 |         // Mock file 10MB
  42 |         await input.setInputFiles({
  43 |             name: 'large.jpg',
  44 |             mimeType: 'image/jpeg',
  45 |             buffer: Buffer.alloc(10 * 1024 * 1024)
  46 |         });
  47 | 
  48 |         const error = page.locator('[data-testid="image-error"]');
  49 |         await expect(error).toContainText('menos de 5MB');
  50 |     });
  51 | 
  52 |     // BUG #4: Manual Order
  53 |     test('should create manual order without registration tab', async ({ page }) => {
  54 |         await page.goto('/dashboard/kanban');
  55 |         await page.click('button:has-text("Novo Pedido")');
  56 | 
  57 |         const registerTab = page.locator('[data-testid="register-tab"]');
  58 |         await expect(registerTab).not.toBeVisible();
  59 | 
  60 |         await page.fill('input[placeholder="Nome"]', 'João');
  61 |         await page.fill('input[placeholder="Telefone"]', '85999999999');
  62 |         await page.click('button:has-text("Criar Pedido")');
  63 | 
  64 |         // Novo pedido deve aparecer
  65 |         const newOrder = page.locator('[data-testid="order-pending"]').first();
  66 |         await expect(newOrder).toBeVisible();
  67 |     });
  68 | 
  69 |     // BUG #5: Product Category
  70 |     test('product should keep assigned category', async ({ page }) => {
  71 |         await page.goto('/dashboard/products');
  72 |         await page.click('button:has-text("Novo Produto")');
  73 | 
  74 |         await page.fill('input[placeholder="Nome"]', 'Café Gelado');
  75 |         await page.selectOption('select[name="category"]', 'cafe-freezers');
  76 |         await page.fill('input[placeholder="Preço"]', '8.50');
  77 |         // Skip image
  78 |         await page.click('button:has-text("Salvar")');
  79 | 
  80 |         // Verificar no cardápio
  81 |         await page.goto('/menu/test');
  82 |         const categorySection = page.locator('h2:has-text("Café Freezers")');
  83 |         const product = categorySection.locator('.. >> text=Café Gelado');
  84 | 
  85 |         await expect(product).toBeVisible();
  86 |     });
  87 | 
  88 |     // BUG #8: Instance Name Read-Only
  89 |     test('evolution instance name should be read-only', async ({ page }) => {
  90 |         await page.goto('/dashboard/settings');
  91 | 
  92 |         const instanceInput = page.locator('input[name="evolution_instance"]');
  93 |         const isDisabled = await instanceInput.evaluate(el => (el as HTMLInputElement).disabled);
  94 | 
  95 |         expect(isDisabled).toBeTruthy();
  96 |     });
  97 | });
  98 | 
```