import { test, expect } from '@playwright/test';

test.describe('Bug Fixes - Regression Tests', () => {

    // BUG #1: Tutorial Overflow
    test('tutorial should fit in mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/register');

        const modal = page.locator('[data-testid="tutorial-modal"]');
        const button = page.locator('[data-testid="next-button"]');

        const boundingBox = await button.boundingBox();
        const viewportSize = page.viewportSize();

        if (boundingBox && viewportSize) {
            expect(boundingBox.y + boundingBox.height).toBeLessThan(viewportSize.height);
        }
    });

    // BUG #2: Dark Mode Menu
    test('product names should be readable in dark mode', async ({ page }) => {
        await page.goto('/menu/test');
        await page.evaluate(() => document.documentElement.classList.add('dark'));

        const productName = page.locator('[data-testid="product-name"]').first();
        const color = await productName.evaluate(el =>
            window.getComputedStyle(el).color
        );

        // rgb(255, 255, 255) ou similar (claro)
        expect(color).toMatch(/rgb\(2[0-5][0-9],\s*2[0-5][0-9],\s*2[0-5][0-9]\)/);
    });

    // BUG #3: Image Upload Error
    test('should show specific error for large image', async ({ page }) => {
        await page.goto('/dashboard/products');
        await page.click('button:has-text("Novo Produto")');

        const input = page.locator('input[type="file"]');
        // Mock file 10MB
        await input.setInputFiles({
            name: 'large.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.alloc(10 * 1024 * 1024)
        });

        const error = page.locator('[data-testid="image-error"]');
        await expect(error).toContainText('menos de 5MB');
    });

    // BUG #4: Manual Order
    test('should create manual order without registration tab', async ({ page }) => {
        await page.goto('/dashboard/kanban');
        await page.click('button:has-text("Novo Pedido")');

        const registerTab = page.locator('[data-testid="register-tab"]');
        await expect(registerTab).not.toBeVisible();

        await page.fill('input[placeholder="Nome"]', 'João');
        await page.fill('input[placeholder="Telefone"]', '85999999999');
        await page.click('button:has-text("Criar Pedido")');

        // Novo pedido deve aparecer
        const newOrder = page.locator('[data-testid="order-pending"]').first();
        await expect(newOrder).toBeVisible();
    });

    // BUG #5: Product Category
    test('product should keep assigned category', async ({ page }) => {
        await page.goto('/dashboard/products');
        await page.click('button:has-text("Novo Produto")');

        await page.fill('input[placeholder="Nome"]', 'Café Gelado');
        await page.selectOption('select[name="category"]', 'cafe-freezers');
        await page.fill('input[placeholder="Preço"]', '8.50');
        // Skip image
        await page.click('button:has-text("Salvar")');

        // Verificar no cardápio
        await page.goto('/menu/test');
        const categorySection = page.locator('h2:has-text("Café Freezers")');
        const product = categorySection.locator('.. >> text=Café Gelado');

        await expect(product).toBeVisible();
    });

    // BUG #8: Instance Name Read-Only
    test('evolution instance name should be read-only', async ({ page }) => {
        await page.goto('/dashboard/settings');

        const instanceInput = page.locator('input[name="evolution_instance"]');
        const isDisabled = await instanceInput.evaluate(el => (el as HTMLInputElement).disabled);

        expect(isDisabled).toBeTruthy();
    });
});
