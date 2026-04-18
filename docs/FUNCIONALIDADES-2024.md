# ZapFlow - Registro de Desenvolvimento

## Data: 15/04/2026

---

## ✅ Funcionalidades Implementadas

### 1. Login e Autenticação
- **Problema:** Sistema usava NocoDB como backend mas Código buscava no PostgreSQL
- **Solução:** Adapatamos auth.ts para usar NocoDB API
- **Status:** ✅ Funcionando

### 2. Banco de Dados PostgreSQL
- Adicionados campos `senha_hash`, `login`, `ativo` na tabela empresas
- **Arquivo:** `database/add_campos_login.sql`
- **Status:** ✅ Campo adicionado no banco

### 3. Erro de SSL (NocoDB)
- Erro `ERR_SSL_PACKET_LENGTH_TOO_LONG`
- **Solução:** Mudamos NOCODB_URL para `https://db.wzapflow.com.br` (sem porta)
- **Status:** ✅ Funcionando

### 4. Configurações - Validação
- Erro "Too small: expected string to have >=2 characters"
- **Solução:** Relaxamos validações em `lib/validations.ts` (CompanyUpdateSchema)
- **Status:** ✅ Funcionando

### 5. Seção Bot nas Configurações
- Design melhorado com robot animado, cores amber/orange/rose
- **Status:** ✅ Funcionando (visualmente)

### 6. Sistema de Insumos
- Quando `controle_estoque` desabilitado:
  - campos de insumos somem nos formulários de produto
  - campos de ficha técnica somem no modal de criar sabor
- **Arquivos alterados:**
  - `app/dashboard/menu/page.tsx`
  - `components/menu/product-form-modal.tsx`
  - `components/biblioteca-item-modal.tsx`
  - `components/slot-groups-management.tsx`
- **Status:** ✅ Funcionando

### 7. Cardápio Público (/menu/[slug])
- Problema: não encontrava店的
- **Solução:** Adicionado busca por `nome_fantasia` além de slug/nincho
- **Status:** ✅ Funcionando

### 8. Produtos Compostos (Montar Pedido)
- Grupo de pizzas não aparecia
- **Problema:** Campo `empresa_id` vs `empresa` no filtro
- **Solução:** Corrigido filtro para `empresa_id`
- **Status:** ✅ Pizzasonline

### 9. Sistema de Completamentos (Bordas)
- **Problema 1:** não salvava no banco
  - Causa: `upsertGrupoSlot` não enviava `completamentos_ids`
  - **Solução:** Adicionado no payload
  - **Status:** ✅ Salvando

- **Problema 2:** completamentos não apareci no modal
  - Causa: compositeProducts só tinha tipo "fracionado", bordas são "adicional"
  - **Solução:** Mudamos compositeProducts para incluir TODOS os tipos
  - **Status:** ⚠️ Em teste

---

## ⚠️ Problemas Pendentes

### 1. Modal de Completamentos (Bordas)
Quando escolhe Pizza não aparece perguntapara adicionar borda.

**Último estado:**
- Debug mostra: `completamentos_ids: 10` (vinculado corretamente)
- allComposites está sendo passado para o modal
- O modal tem useEffect que detecta completamentos

**O que precisa funcionar:**
- Escolher pizza → abrir modal →perguntar "deseja adicionar borda?" → abrir grupo Bordas

**Debug necessário:**
- Verificar se `product.completamentos_ids` chega no modal
- Verificar se `allComposites` tem o grupo de id 10 (Bordas)

---

## 📝 Códigos das Tabelas NocoDB

| Tabela | ID |
|-------|-----|
| empresas | mp08yd7oaxn5xo2 |
| products | mh81t2xp1uml6pc |
| categories | mo5so5g7gvlbwyo |
| grupos_slots | m1h9jeye8hcd4k6 |
| itens_base | mfcp67skbxq4nt5 |
| item_base_insumo | mev9fkmt1jaapiv |

---

## 🔧 Variáveis de Ambiente (.env)

```
DATABASE_URL=postgres://postgres:rick5264postgres@db.wzapflow.com.br:5432/chatwoot?sslmode=disable
NOCODB_URL=https://db.wzapflow.com.br
NOCODB_TOKEN=lriop3EmqIOn4_T5hhpdPbzIrAYqWjVV8hlNS3VI
EMPRESAS_TABLE_ID=mp08yd7oaxn5xo2
```

---

## 📅 Rascunho de fluxo desejado

1. Cliente abre /menu/pizza
2. vCardápio mostra Pizza (tipo fracionado)
3. escolhe → abre modal de selecionar sabores
4. Escolhe 2 sabores → clica "Adicionar ao carrinho"
5. **NOVA func:** Se grupo tiver completamentos_ids, perguntar "Deseja adicionar [Borda]?"
   - SeSim → abrir grupo Bordas
   - SeNão → adicionar ao carrinho

---

## Arquivos Principais Alterados

- `app/actions/auth.ts` - autenticação
- `app/actions/public-menu.ts` - cardápio público
- `app/actions/grupos-slots.ts` - grupos de sabores
- `app/dashboard/settings/page.tsx` - config
- `app/dashboard/menu/page.tsx` - menu admin
- `components/menu/composite-product-modal.tsx` - modal montar pedido
- `components/menu/menu-filter.tsx` - filtro cardápio
- `components/biblioteca-item-modal.tsx` - criar sabor
- `components/grupo-slot-modal.tsx` - criar/edit grupo
- `lib/validations.ts` - validações