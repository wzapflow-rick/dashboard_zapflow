# Design: Completamentos Vinculados a Grupos + Observação do Pedido

**Data:** 2026-04-14

## Problema

1. Não é possível criar uma hierarquia onde um grupo "aciona" outros grupos como completamentos (ex: após escolher tamanho da pizza, mostrar bordas)
2. Não existe campo de observação do cliente no pedido

## Solução

### 1. Completamentos Vinculados

**Estrutura de Dados:**
- Nova coluna `completamentos_ids` na tabela `grupos_slots` (JSON array de IDs)
- Quando um grupo tiver completamentos vinculados, após selecionar os itens dele, o menu perguntará se deseja ver os completamentos

**Fluxo no Menu:**
1. Cliente seleciona produto → abre grupo de slots
2. Seleciona os itens → clica em "Continuar"
3. Se houver completamentos vinculados, mostra botão "Adicionar Completamentos"
4. Abre os grupos completamentos para seleção
5. Campo de observação opcional
6. Adicionar ao carrinho

**Interface de Gestão:**
- No modal de editar grupo, seção "Completamentos"
- Selecionar múltiplos grupos existentes como completamentos

### 2. Observação do Pedido

**Estrutura de Dados:**
- Campo `observacao` no modelo de item do carrinho (opcional)

**Interface:**
- Campo de texto no modal de finalização do pedido
- Exibição no kanban e detalhes do pedido

## Implementação

### Banco de Dados
```sql
ALTER TABLE grupos_slots ADD COLUMN IF NOT EXISTS completamentos_ids JSONB DEFAULT '[]'::jsonb;
```

### Backend
- Atualizar `GrupoSlotSchema` com `completamentos_ids`
- Atualizar interface `GrupoSlot`
- Atualizar `public-menu.ts` para carregar completamentos

### Frontend
- Atualizar `grupo-slot-modal.tsx` com UI de vinculação
- Atualizar modais de seleção para fluxo com completamentos + observação
- Exibir observação no kanban

## Compatibilidade

Grupos existentes mantêm `completamentos_ids = []` (comportamento atual).