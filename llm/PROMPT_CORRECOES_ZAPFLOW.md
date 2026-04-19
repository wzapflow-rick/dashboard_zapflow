# 🔧 PROMPT DE CORREÇÃO - ZapFlow Bugs Críticos

## Contexto
Foram identificados **8 bugs críticos** durante testes mobile/desktop que afetam UX e funcionalidades principais. Este prompt detalha cada problema e sua solução esperada.

---

## 🐛 BUG #1: Tutorial de Criação de Conta Overflow (Mobile)

**Problema:**
- Ao criar conta, o tutorial/modal ultrapassa os limites da tela mobile
- Usuário precisa diminuir zoom para encontrar o botão "Próximo"
- Afeta UX e acessibilidade

**Localização Provável:**
- Arquivo: `/app/(auth)/register/page.tsx` ou componente modal de tutorial
- Componentes: Modal, Dialog, ou Step-by-step component

**Solução Esperada:**
1. **Audit da altura do modal/dialog:**
   - Máximo de altura: 85vh (deixar 15% de espaço para header/footer)
   - Overflow-y: auto com padding adequado
   
2. **Responsive Design:**
   - Mobile (<768px): 100vw - 32px (padding), max-height: 70vh
   - Tablet: 600px max-width
   - Desktop: 800px max-width

3. **Botões de navegação:**
   - Devem ser sticky no bottom do modal (position: sticky ou flex layout)
   - Altura mínima: 48px (toque confortável)
   - Padding: 12px 16px

4. **Testes:**
   - iPhone SE (375px): scroll confortável
   - iPhone 12 (390px): sem necessidade de zoom
   - iPad: layout apropriado

**Código esperado (Tailwind):**
```tsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
  <div className="bg-white dark:bg-gray-900 rounded-lg max-h-[85vh] max-w-[95vw] md:max-w-md overflow-y-auto">
    {/* conteúdo */}
    <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t flex gap-3 p-4 justify-between">
      <button>Anterior</button>
      <button>Próximo</button>
    </div>
  </div>
</div>
```

---

## 🐛 BUG #2: Dark Mode Bugado no Link do Cardápio

**Problema:**
- No cardápio público (`/menu/[slug]`), o dark mode está com problemas de contraste
- Nomes dos produtos aparecem em **branco sobre fundo claro** (ilegível)
- Afeta readabilidade total do cardápio

**Localização Provável:**
- Arquivo: `/app/(public)/menu/[slug]/page.tsx`
- Componentes: Product cards, category headers, product list

**Solução Esperada:**

1. **Auditoria de cores no dark mode:**
   - Revisar todos `text-white` → devem ser `dark:text-white`
   - Revisar backgrounds → `bg-white dark:bg-gray-900`
   - **Textos não devem estar hardcoded** como `className="text-white"`

2. **Variáveis CSS para contraste:**
   ```css
   /* Global colors */
   :root {
     --text-primary-light: #1f2937;
     --text-primary-dark: #f3f4f6;
     --bg-primary-light: #ffffff;
     --bg-primary-dark: #111827;
   }
   ```

3. **Checklist de elementos:**
   - [ ] Nomes de produtos: `text-gray-900 dark:text-white`
   - [ ] Descrições: `text-gray-600 dark:text-gray-300`
   - [ ] Preços: `text-green-600 dark:text-green-400`
   - [ ] Backgrounds de cards: `bg-white dark:bg-gray-800`
   - [ ] Borders: `border-gray-200 dark:border-gray-700`

4. **Testes:**
   - Ativar dark mode do sistema (iOS/Android/Windows)
   - Verificar cada elemento no cardápio
   - Validar contraste com [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

**Código esperado:**
```tsx
<div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
  <h3 className="text-gray-900 dark:text-white font-semibold text-lg">
    {product.name}
  </h3>
  <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
    {product.description}
  </p>
  <p className="text-green-600 dark:text-green-400 font-bold mt-2">
    R$ {product.price.toFixed(2)}
  </p>
</div>
```

---

## 🐛 BUG #3: Erro ao Upload de Imagem + Erro Genérico ao Criar Produto

**Problema:**
- Ao criar produto, aparece: `"Erro ao fazer upload na imagem"`
- Simultaneamente: `"Erro ao criar produto no servidor"`
- Quando cria categoria, erro do servidor desaparece, mas erro da imagem persiste
- Impossível criar produtos com imagem

**Localização Provável:**
- Arquivo: `/app/dashboard/products/page.tsx` ou `/components/ProductForm.tsx`
- Endpoints: `POST /api/upload`, `POST /api/products`, `POST /api/categories`
- Middleware/Server Actions relacionadas a upload

**Solução Esperada:**

1. **Debugar upload de imagem:**
   - Verificar se endpoint de upload está retornando erro
   - Logs no console: `console.error(response)` para identificar erro real
   - Validar MIME types aceitos (jpeg, png, webp)
   - Verificar se size limit (ex: 5MB) está sendo respeitado

2. **Erro genérico do servidor:**
   - Implementar tratamento granular de erros
   - Diferenciar: erro de upload vs erro de criação do produto
   - Retornar erro específico ao cliente (não genérico)

3. **Fluxo esperado:**
   ```
   1. Usuário seleciona imagem
   2. Validação local (tamanho, tipo)
   3. Upload para storage (NocoDB/Cloudinary/S3)
   4. Se upload OK → criar produto com URL da imagem
   5. Se upload FAIL → exibir erro específico e NOT criar produto
   6. Se criação FAIL → deletar imagem já uploadada
   ```

4. **Código esperado (Server Action):**
   ```typescript
   // Validação
   if (!image) {
     return { error: "Imagem é obrigatória" };
   }
   if (image.size > 5 * 1024 * 1024) {
     return { error: "Imagem deve ter menos de 5MB" };
   }
   
   // Upload
   let imageUrl;
   try {
     const formData = new FormData();
     formData.append('file', image);
     const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
     if (!uploadRes.ok) {
       const err = await uploadRes.json();
       return { error: `Erro ao fazer upload: ${err.message}` };
     }
     imageUrl = (await uploadRes.json()).url;
   } catch (err) {
     return { error: `Falha no upload: ${err.message}` };
   }
   
   // Criação do produto
   try {
     const productRes = await fetch('/api/products', {
       method: 'POST',
       body: JSON.stringify({ name, price, imageUrl, ...rest })
     });
     if (!productRes.ok) {
       // Deletar imagem se falhar
       await deleteImage(imageUrl);
       const err = await productRes.json();
       return { error: `Erro ao criar produto: ${err.message}` };
     }
     return { success: true, product: await productRes.json() };
   } catch (err) {
     await deleteImage(imageUrl);
     return { error: `Erro no servidor: ${err.message}` };
   }
   ```

5. **Testes:**
   - Criar produto COM imagem (sucesso esperado)
   - Criar produto SEM imagem (deve dar erro)
   - Upload de imagem > 5MB (deve dar erro)
   - Upload de arquivo não-imagem (deve dar erro)
   - Simulação de falha de servidor (rollback automático)

---

## 🐛 BUG #4: Erro ao Criar Produto Manual no Kanban

**Problema:**
- Ao clicar em "Criar Produto Manual" no Kanban, erro: `"Erro ao criar produto manual"`
- A aba de "Registrar Cliente" abre, mas depois continua com o erro
- **Esperado:** Não deveria pedir cadastro obrigatório para pedidos manuais (ou ser opcional)

**Localização Provável:**
- Arquivo: `/app/dashboard/kanban/page.tsx` ou componente modal de pedido manual
- Server Action ou API endpoint para criar pedido manual

**Solução Esperada:**

1. **Fluxo sem cadastro obrigatório:**
   - Ao criar pedido manual, pedir informações mínimas:
     - [ ] Nome do cliente (obrigatório)
     - [ ] Telefone (obrigatório)
     - [ ] Endereço (opcional, pode ser retirada)
     - [ ] Bairro (opcional)
   - **NÃO** abrir aba/modal de cadastro completo

2. **Lógica:**
   ```
   Se cliente já existe (by telefone) → usar dados existentes
   Se cliente não existe → criar registro rápido (sem redirect)
   Criar pedido vinculado ao cliente
   Redirecionar para kanban com pedido novo
   ```

3. **UX esperada:**
   - Modal simples com 2-3 campos
   - Botão "Criar Pedido" direto (sem step adicional)
   - Validação em tempo real
   - Mensagem de sucesso + reflexo no kanban

4. **Código esperado:**
   ```tsx
   // Modal de Pedido Manual - SEM cadastro obrigatório
   export function QuickOrderModal() {
     const [name, setName] = useState('');
     const [phone, setPhone] = useState('');
     const [loading, setLoading] = useState(false);
     const [error, setError] = useState('');
   
     const handleCreateOrder = async () => {
       setLoading(true);
       setError('');
       
       try {
         // 1. Validação
         if (!name.trim()) {
           setError('Nome é obrigatório');
           return;
         }
         if (!phone.trim()) {
           setError('Telefone é obrigatório');
           return;
         }
         
         // 2. Criar ou buscar cliente
         const clientRes = await fetch('/api/clients', {
           method: 'POST',
           body: JSON.stringify({ name, phone })
         });
         
         if (!clientRes.ok) throw new Error('Erro ao salvar cliente');
         const client = await clientRes.json();
         
         // 3. Criar pedido
         const orderRes = await fetch('/api/orders', {
           method: 'POST',
           body: JSON.stringify({ clientId: client.id, items: [] })
         });
         
         if (!orderRes.ok) throw new Error('Erro ao criar pedido');
         const order = await orderRes.json();
         
         // 4. Fechar modal e atualizar kanban
         onClose();
         refreshKanban();
       } catch (err) {
         setError(err.message);
       } finally {
         setLoading(false);
       }
     };
     
     return (
       <div className="p-6 space-y-4">
         <input 
           placeholder="Nome do cliente" 
           value={name} 
           onChange={(e) => setName(e.target.value)}
         />
         <input 
           placeholder="Telefone (WhatsApp)" 
           value={phone} 
           onChange={(e) => setPhone(e.target.value)}
         />
         {error && <div className="text-red-500 text-sm">{error}</div>}
         <button 
           onClick={handleCreateOrder} 
           disabled={loading}
         >
           {loading ? 'Criando...' : 'Criar Pedido'}
         </button>
       </div>
     );
   }
   ```

5. **Testes:**
   - Criar pedido manual com dados válidos (sucesso esperado)
   - Sem nome (erro esperado)
   - Sem telefone (erro esperado)
   - Telefone de cliente existente (reutilizar cliente)
   - Verificar reflexo no kanban imediatamente

---

## 🐛 BUG #5: Produto Criado Sem Foto Vai para Categoria "Outros"

**Problema:**
- Ao criar produto sem imagem, ele aparece no cardápio público
- **Mas:** vai para categoria "Outros" mesmo que tenha sido criado em outra categoria (ex: "Café Freezers")
- Esperado: produto deve respeitar a categoria selecionada

**Localização Provável:**
- Arquivo: `/app/dashboard/products/page.tsx` ou Server Action de criação
- Banco de dados: validação de category_id

**Solução Esperada:**

1. **Audit da criação de produto:**
   - Verificar se `category_id` está sendo salvado corretamente
   - Verificar se há validação no NocoDB que força categoria padrão
   - Confirmar se frontend está enviando `category_id` corretamente

2. **Lógica esperada:**
   ```
   1. Usuário seleciona categoria "Café Freezers"
   2. Cria produto COM OU SEM imagem
   3. Produto é salvo com category_id = "cafe-freezers"
   4. No cardápio público, produto aparece em "Café Freezers" (não em "Outros")
   5. Se categoria_id for NULL → aí sim vai para "Outros" (fallback)
   ```

3. **Código esperado (Server Action):**
   ```typescript
   async function createProduct(formData) {
     const name = formData.get('name');
     const categoryId = formData.get('category_id');
     const price = formData.get('price');
     const image = formData.get('image');
     
     // Validação
     if (!name || !categoryId) {
       return { error: 'Nome e categoria são obrigatórios' };
     }
     
     // Se category_id vem vazio, NÃO USAR FALLBACK
     const finalCategoryId = categoryId && categoryId !== '' 
       ? categoryId 
       : null; // ou rejeitar
     
     // Salvar no NocoDB
     const res = await nocodb.post('/products', {
       name,
       category_id: finalCategoryId,
       price: parseFloat(price),
       image_url: imageUrl || null
     });
     
     return { success: true, product: res.data };
   }
   ```

4. **Testes:**
   - Criar produto em categoria "Café Freezers" COM imagem → verificar categoria
   - Criar produto em categoria "Café Freezers" SEM imagem → verificar categoria
   - Recarregar página de cardápio → categoria persiste
   - Verificar direto no NocoDB se category_id está salvado

---

## 🐛 BUG #6: Dark Mode Bugado na Página de Relatórios

**Problema:**
- Página de relatórios (`/dashboard/reports` ou similar) tem dark mode quebrado
- Afeta readabilidade dos gráficos/dados

**Localização Provável:**
- Arquivo: `/app/dashboard/reports/page.tsx`
- Componentes: Charts, tables, headers

**Solução Esperada:**
- Mesmo padrão do **BUG #2** (dark mode)
- Aplicar:
  ```tsx
  <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
    {/* Conteúdo */}
  </div>
  ```
- Revisar bibliotecas de charts (recharts, chart.js, etc.) para verificar suporte a dark mode
- Se usar `className` no chart, adicionar `dark:` variants apropriados

**Código para Tailwind + Recharts:**
```tsx
<div className="bg-white dark:bg-gray-900 p-6 rounded-lg">
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data}>
      <CartesianGrid 
        strokeDasharray="3 3" 
        stroke="currentColor" 
        className="opacity-20 dark:opacity-30"
      />
      <XAxis 
        stroke="currentColor" 
        className="text-gray-600 dark:text-gray-400"
      />
      <YAxis 
        stroke="currentColor" 
        className="text-gray-600 dark:text-gray-400"
      />
      <Line stroke="rgb(34, 197, 94)" />
    </LineChart>
  </ResponsiveContainer>
</div>
```

---

## 🐛 BUG #7: Imagem de Produto Persiste com Erro

**Problema:**
- Ao criar categoria, o erro genérico do servidor desaparece
- **MAS:** o erro de upload de imagem persiste
- Sugestão: deve ser um cache/estado que não está sendo limpo

**Localização Provável:**
- Arquivo: `/components/ProductForm.tsx` ou state manager (useState/Redux)
- Hook: `useEffect` que não está limpando erros

**Solução Esperada:**

1. **Limpeza de erros no modal:**
   ```typescript
   useEffect(() => {
     // Limpar erro quando modal abre
     setImageError('');
     setProductError('');
   }, [isOpen]);
   ```

2. **Isolamento de erros:**
   - `imageError`: apenas para upload
   - `productError`: apenas para criação de produto
   - Não misturar os dois

3. **Reset após sucesso:**
   ```typescript
   if (success) {
     setImageError('');
     setProductError('');
     setName('');
     setImage(null);
     setCategory('');
     closeModal();
   }
   ```

---

## 🐛 BUG #8: Remover Opção de Mudar Nome da Instância da Evolution API

**Problema:**
- Na aba "Configurações", o usuário consegue mudar o nome da instância da Evolution API
- **Esperado:** essa opção deve ser removida (não é seguro permitir alteração)

**Localização Provável:**
- Arquivo: `/app/dashboard/settings/page.tsx`
- Campo: input com label "Nome da Instância" ou similar

**Solução Esperada:**

1. **Remover campo de input:**
   - Deletar o `<input>` ou `<textarea>` para nome da instância
   - Se precisar exibir (apenas leitura), usar `<div className="text-gray-500">` ou badge

2. **Mover para área administrativa (opcional):**
   - Se houver painel de superuser/admin, lá pode deixar editável
   - Usuário comum: apenas leitura

3. **Código esperado:**
   ```tsx
   // ❌ REMOVER ISTO:
   <input 
     type="text"
     value={instanceName}
     onChange={(e) => setInstanceName(e.target.value)}
     placeholder="Nome da instância"
   />
   
   // ✅ MANTER ISTO (APENAS LEITURA):
   <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm text-gray-600 dark:text-gray-400">
     <strong>Instância Evolution:</strong> {instanceName}
   </div>
   ```

---

## 📋 RESUMO DE AÇÕES

| # | Bug | Prioridade | Status |
|---|-----|-----------|--------|
| 1 | Tutorial overflow mobile | 🔴 Alta | ✅ Corrigido |
| 2 | Dark mode cardápio | 🔴 Alta | ✅ Corrigido |
| 3 | Upload imagem + erro genérico | 🔴 Alta | ✅ Corrigido (Rollback via deferimento no menu-utils) |
| 4 | Pedido manual com erro | 🔴 Alta | ✅ Corrigido (Removido fluxo obrigatório) |
| 5 | Categoria "Outros" padrão | 🔴 Alta | ✅ Corrigido (Tipo flexível string/number) |
| 6 | Dark mode relatórios | 🟡 Média | ✅ Corrigido (Auditoria de cores aplicadas) |
| 7 | Erro de imagem persiste | 🟡 Média | ✅ Corrigido (Limpeza de estado de toasts) |
| 8 | Remover nome da instância | 🟡 Média | ✅ Corrigido |

---

## 🧪 CHECKLIST DE VALIDAÇÃO PÓS-CORREÇÃO

- [x] Tutorial carrega sem overflow em iPhone SE (375px)
- [x] Cardápio público tem contraste OK em dark mode
- [x] Upload de imagem retorna erro específico (não genérico)
- [x] Produto manual cria sem cadastro obrigatório
- [x] Produto em categoria específica mantém categoria
- [x] Página de relatórios legível em dark mode
- [x] Erros de imagem limpam corretamente
- [x] Campo de instância Evolution é read-only
- [x] Todos os testes passam em mobile + desktop
- [x] Navegador console: sem warnings ou errors não esperados

---

## 🚀 PRÓXIMOS PASSOS

1. Priorizar bugs por impacto (todos têm alta prioridade)
2. Iniciar por BUG #3 (upload) pois afeta criação de produtos
3. Depois BUG #4 (pedido manual) pois afeta kanban
4. Testes em produção após cada correção
5. Validar em mobile real (não apenas DevTools)

