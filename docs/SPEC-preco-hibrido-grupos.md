# Design: Sistema de Preço Híbrido para Grupos de Slots

**Data:** 2026-04-14

## Problema

Atualmente, o sistema de grupos de slots (como tamanhos de pizza) usa apenas o preço individual de cada item-base. Isso causa problemas:
- Pizza M com 2 sabores = mesmo preço que Pizza P com 1 sabor
- Não considera quantidade de material usado

## Solução

Implementar sistema híbrido onde cada grupo pode escolher entre:
- **Por item**: usa preço de cada item-base (comportamento atual)
- **Preço fixo**: define um preço único para todo o grupo

## Estrutura de Dados

### Tabela: grupos_slots

```sql
ALTER TABLE grupos_slots ADD COLUMN IF NOT EXISTS modo_preco VARCHAR(20) DEFAULT 'por_item';
ALTER TABLE grupos_slots ADD COLUMN IF NOT EXISTS preco_fixo NUMERIC(10,2) DEFAULT 0;
```

- `modo_preco`: `'por_item'` (padrão) ou `'fixo'`
- `preco_fixo`: preço fixo quando modo = 'fixo'

### Tabela: itens_base

- Campo existente `preco_sugerido` será usado quando modo = 'por_item'

## Implementação

### 1. Backend (grupos-slots.ts)

- Atualizar `GrupoSlotSchema` para incluir `modo_preco` e `preco_fixo`
- Atualizar interface `GrupoSlot`
- Manter retrocompatibilidade com grupos existentes

### 2. Frontend (grupo-slot-modal.tsx)

- Adicionar dropdown "Tipo de preço" (por item / fixo)
- Mostrar campo de preço quando tipo = fixo

### 3. Carrinho (public-menu.ts)

- Verificar `modo_preco` do grupo
- Se 'fixo': usar `preco_fixo` do grupo
- Se 'por_item': somar preços dos itens selecionados

## Compatibilidade

Grupos existentes mantêm `modo_preco = 'por_item'` (comportamento atual).