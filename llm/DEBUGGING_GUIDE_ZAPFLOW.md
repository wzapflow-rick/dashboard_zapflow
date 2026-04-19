# 🔍 GUIA DE DEBUGGING E TESTES - ZapFlow

## 1. CONFIGURAÇÃO DO AMBIENTE DE TESTE

### 1.1 Variáveis de Ambiente para Debug
```bash
# .env.local
NEXT_PUBLIC_DEBUG_MODE=true
NEXT_PUBLIC_LOG_ERRORS=true
LOG_IMAGE_UPLOAD=true
LOG_PRODUCT_CREATION=true
```

### 1.2 Browser DevTools Config
```javascript
// Console - copiar e colar para ativar logs detalhados
localStorage.setItem('debug_zapflow', 'true');
console.log('✅ Debug mode ativado');

// Desativar
localStorage.removeItem('debug_zapflow');
```

---

## 2. TESTES DE RESPONSIVENESS (BUG #1)

### 2.1 Chrome DevTools
```
1. F12 → Device Toolbar
2. Testar dispositivos:
   - iPhone SE (375 x 667)
   - iPhone 12 (390 x 844)
   - iPhone 14 Pro (393 x 852)
   - Samsung Galaxy S21 (360 x 800)
   - iPad (768 x 1024)
3. Scroll na página de registro
4. Verificar se botão "Próximo" é sempre visível sem zoom
```

### 2.2 Teste Real Mobile
```bash
# 1. Deploy local com ngrok
npm run dev
# Terminal 2
ngrok http 3000
# Copiar URL (ex: https://xxxx-xx-xx-xxx-xx.ngrok.io)

# 2. Abrir no celular
# - Acessar URL do ngrok
# - Testar tutorial de registro
# - Verificar se overlay/modal fica dentro da viewport
# - NÃO deve precisar de zoom
```

### 2.3 Checklist Visual
- [ ] Altura do modal: max 85vh no mobile
- [ ] Botões fixos no bottom
- [ ] Scroll interno do modal funciona
- [ ] Padding e gaps não reduzem espaço demais
- [ ] Texto legível sem zoom

---

## 3. TESTES DE DARK MODE (BUG #2 & #6)

### 3.1 Ativar Dark Mode no Browser
```javascript
// DevTools Console
document.documentElement.classList.toggle('dark');

// Ou via Settings do SO
// Windows: Settings → Personalization → Colors → Dark
// macOS: System Preferences → General → Appearance → Dark
// iOS: Settings → Display & Brightness → Dark Mode
// Android: Settings → Display → Dark theme
```

### 3.2 Validar Contraste
```bash
# 1. Instalar WebAIM Contrast Checker
# https://webaim.org/resources/contrastchecker/

# 2. Para cada elemento visível:
# - Selecionar cor do texto
# - Selecionar cor do background
# - Validar se contraste >= 4.5:1 (AA) ou 7:1 (AAA)

# 3. Elementos críticos a testar:
# - Nomes de produtos
# - Preços
# - Botões
# - Headers
# - Descrições
```

### 3.3 Teste Automatizado (Playwright/Cypress)
```javascript
// tests/dark-mode.test.ts
import { test, expect } from '@playwright/test';

test('dark mode contrast on menu page', async ({ page }) => {
  await page.goto('/menu/test-slug');
  
  // Ativar dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  
  // Validar cores
  const productName = page.locator('[data-testid="product-name"]').first();
  const color = await productName.evaluate(el => 
    window.getComputedStyle(el).color
  );
  
  // Deve ser branco ou clara, não escura
  expect(color).not.toBe('rgb(0, 0, 0)');
  expect(color).not.toBe('rgb(107, 114, 128)');
});
```

### 3.4 Checklist Dark Mode
- [ ] Cardápio público: legível em dark mode
- [ ] Relatórios: gráficos com contraste OK
- [ ] Cards: fundo escuro, texto claro
- [ ] Borders: visível em ambos modos
- [ ] Inputs: placeholder visível em dark mode
- [ ] Badges: contraste >= 4.5:1

---

## 4. TESTES DE UPLOAD DE IMAGEM (BUG #3)

### 4.1 Preparar Arquivos de Teste
```bash
mkdir -p test-images

# Criar imagens de teste
# 1. Imagem válida (PNG 200x200px)
convert -size 200x200 xc:red test-images/valid.png

# 2. Imagem grande (10MB - para testar limite)
dd if=/dev/zero of=test-images/large.jpg bs=1M count=10

# 3. Arquivo não-imagem
echo "not an image" > test-images/fake.jpg

# 4. SVG (validar se aceita ou rejeita)
echo '<svg></svg>' > test-images/image.svg
```

### 4.2 Teste Manual
```
1. Ir para Dashboard > Produtos
2. Clicar em "Novo Produto"
3. Preencher dados:
   - Nome: "Pizza Margherita"
   - Categoria: "Pizzas"
   - Preço: "35.00"
4. Selecionar imagem:
   a) Válida (PNG/JPG < 5MB) → Sucesso esperado
   b) Grande (> 5MB) → Erro esperado
   c) Não-imagem → Erro esperado
5. Verificar mensagens de erro:
   - EVITAR: "Erro genérico"
   - USAR: "Imagem deve ter menos de 5MB"
```

### 4.3 Teste com Network Throttling
```javascript
// Simular conexão lenta (DevTools)
1. F12 → Network tab
2. Throttle dropdown → "Slow 4G"
3. Tentar upload → Verificar timeout handling
4. Não deve ser bloqueado (deve ter timeout adequado)
```

### 4.4 Teste de Rollback
```
1. Mock servidor retornar erro após upload OK
2. Verificar se imagem é deletada do storage
3. Verificar se produto NÃO é criado
4. Verificar se estado está limpo para novo upload

// Mock no Playwright
await page.route('/api/products', route => {
  route.abort('failed');
});
```

### 4.5 Checklist Upload
- [ ] Upload de imagem válida: sucesso
- [ ] Upload sem imagem: erro específico
- [ ] Upload > 5MB: erro específico
- [ ] Upload arquivo não-imagem: erro específico
- [ ] Network lento: timeout não quebra
- [ ] Erro do servidor: rollback automático
- [ ] Console sem erros não tratados

---

## 5. TESTES DE PEDIDO MANUAL (BUG #4)

### 5.1 Teste de Fluxo
```
Cenário 1: Cliente novo
1. Kanban > Botão "Novo Pedido"
2. Modal abre (SEM aba de cadastro)
3. Preencher:
   - Nome: "João da Silva"
   - Telefone: "85999999999"
4. Clicar "Criar Pedido"
5. Modal fecha
6. Novo pedido aparece em "Pendentes"
7. ✅ Cliente criado automaticamente

Cenário 2: Cliente existente
1. Clicar "Novo Pedido"
2. Preencher nome + telefone de cliente existente
3. Clicar "Criar Pedido"
4. ✅ Reutiliza cliente existente (sem duplicar)
5. Novo pedido vinculado ao cliente

Cenário 3: Validação
1. Clicar "Criar Pedido" sem nome
2. Erro esperado: "Nome é obrigatório"
3. Clicar "Criar Pedido" sem telefone
4. Erro esperado: "Telefone é obrigatório"
```

### 5.2 Validar Estado do Modal
```javascript
// Verificar se aba de cadastro não existe
const registerTab = document.querySelector('[data-testid="register-tab"]');
expect(registerTab).toBeNull(); // Não deve existir

// Verificar se modal é simples (2 inputs)
const inputs = document.querySelectorAll('input');
expect(inputs.length).toBeLessThanOrEqual(2);
```

### 5.3 Checklist Pedido Manual
- [ ] Modal abre sem aba de cadastro
- [ ] Criar pedido com cliente novo: sucesso
- [ ] Criar pedido com cliente existente: sucesso
- [ ] Sem nome: erro específico
- [ ] Sem telefone: erro específico
- [ ] Novo pedido aparece no kanban
- [ ] Cliente vinculado corretamente

---

## 6. TESTES DE CATEGORIA DE PRODUTO (BUG #5)

### 6.1 Teste de Atribuição de Categoria
```
Precondição: Criar categorias
1. Dashboard > Categorias
2. Criar:
   - "Pizzas"
   - "Café Freezers"
   - "Bebidas"

Teste 1: Com imagem
1. Novo Produto
2. Nome: "Café Gelado"
3. Categoria: "Café Freezers"
4. Preço: "8.50"
5. Imagem: upload válido
6. Salvar
7. Verificar cardápio público:
   - Deve estar em "Café Freezers"
   - NÃO em "Outros"

Teste 2: Sem imagem
1. Novo Produto
2. Nome: "Café Quentinho"
3. Categoria: "Café Freezers"
4. Preço: "6.50"
5. SEM imagem
6. Salvar
7. Verificar cardápio público:
   - Deve estar em "Café Freezers"
   - NÃO em "Outros"
```

### 6.2 Validação no Banco de Dados
```sql
-- Verificar no NocoDB/SQL diretamente
SELECT name, category_id, image_url 
FROM products 
ORDER BY created_at DESC 
LIMIT 5;

-- Validar category_id NÃO é NULL ou vazio
-- Validar categoria existe na tabela categories
```

### 6.3 Checklist Categoria
- [ ] Categoria selecionada é salva corretamente
- [ ] Produto com imagem respeita categoria
- [ ] Produto sem imagem respeita categoria
- [ ] Recarregar página: categoria persiste
- [ ] Verificar no DB: category_id correto
- [ ] Nenhum produto em "Outros" sem motivo

---

## 7. TESTES DE RELATÓRIOS (BUG #6)

### 7.1 Verificar Elementos Visíveis
```javascript
// DevTools Console - verificar todos elementos
document.querySelectorAll('[data-testid*="report"]').forEach(el => {
  const computed = window.getComputedStyle(el);
  console.log({
    element: el.tagName,
    color: computed.color,
    backgroundColor: computed.backgroundColor,
    visibility: computed.visibility
  });
});
```

### 7.2 Gráficos Específicos
```
- Gráfico de faturamento por dia
- Gráfico de pedidos por hora
- Tabela de Top 5 produtos
- Cards de resumo (total faturado, etc)

Para cada elemento:
1. Light mode: verificar legibilidade
2. Dark mode: verificar legibilidade
3. Imprimir (Ctrl+P): verificar se fica ok
4. Responsiveness: mobile + tablet
```

### 7.3 Checklist Relatórios
- [ ] Gráficos renderizam sem erro
- [ ] Todos elementos legíveis em light mode
- [ ] Todos elementos legíveis em dark mode
- [ ] Dados corretos (não vazios ou NaN)
- [ ] Responde em < 3 segundos
- [ ] Console sem erros de biblioteca (recharts, etc)

---

## 8. TESTES DE CONFIGURAÇÕES (BUG #8)

### 8.1 Validar Remoção de Campo
```javascript
// DevTools Console
const instanceInput = document.querySelector('input[name="evolution_instance_name"]');
const instanceDisplay = document.querySelector('[data-testid="evolution-instance-display"]');

// Deve NÃO ter input editável
expect(instanceInput).toBeNull();

// Deve ter apenas exibição read-only
expect(instanceDisplay).toExist();
expect(instanceDisplay.textContent).toBeTruthy();
```

### 8.2 Verificar Permissões
```
1. Login como usuário comum
2. Ir para Configurações > Evolution API
3. Campo de nome da instância deve ser:
   - Visível (apenas para referência)
   - Não editável (disabled ou apenas texto)
   - Sem botão de salvar neste campo
4. Apenas campos legítimos devem ser editáveis:
   - Nome da empresa
   - Telefone
   - E-mail
   - Chave PIX
   - Horários
```

### 8.3 Checklist Configurações
- [ ] Campo de instância removido do form
- [ ] Se exibido, apenas em read-only
- [ ] Sem input nem button para editar instância
- [ ] Outros campos funcionam normalmente
- [ ] Validação salva corretamente

---

## 9. SCRIPT AUTOMATIZADO (Playwright)

```typescript
// tests/bugs-regression.test.ts
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
    
    expect(boundingBox.y + boundingBox.height).toBeLessThan(viewportSize.height);
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
    const isDisabled = await instanceInput.evaluate(el => el.disabled);
    
    expect(isDisabled).toBeTruthy();
  });
});
```

---

## 10. COMMAND LINE HELPERS

```bash
# Rodar testes específicos
npm run test -- bugs-regression.test.ts

# Rodar com visibilidade
npm run test -- bugs-regression.test.ts --headed

# Gerar relatório HTML
npm run test -- bugs-regression.test.ts --reporter=html

# Debug mode
npm run test -- bugs-regression.test.ts --debug

# Smoke test (testes básicos)
npm run test -- smoke.test.ts
```

---

## 11. CHECKLIST FINAL PRÉ-PRODUÇÃO

- [ ] Todos 8 bugs foram corrigidos
- [ ] Testes manuais passaram em mobile real
- [ ] Testes automatizados passam
- [ ] Dark mode OK em 3+ browsers
- [ ] Sem erros no console do browser
- [ ] Sem erros no servidor (logs)
- [ ] Performance: páginas carregam < 3s
- [ ] Responsiveness: 375px até 1920px OK
- [ ] Acessibilidade: WCAG AA
- [ ] Deploy em staging antes de produção

---

## 12. REFERÊNCIAS ÚTEIS

- Tailwind Dark Mode: https://tailwindcss.com/docs/dark-mode
- WCAG Contrast: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum
- Playwright Testing: https://playwright.dev/docs/intro
- Next.js Image Optimization: https://nextjs.org/docs/basic-features/image-optimization
- NocoDB API: https://nocodb.com/docs/

