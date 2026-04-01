# Changelog - ZapFlow Dashboard

## [2.0.0] - 2026-04-01

### 🎨 Interface do Usuário (UI)

#### Dashboard
- **Corrigido**: Gráfico de vendas por hora agora exibe todas as 24 horas (0h-23h)
- **Corrigido**: Barras do gráfico agora são renderizadas corretamente com altura proporcional
- **Melhoria**: Adicionado tooltip ao hover das barras mostrando quantidade de pedidos

#### Base de Clientes
- **Novo**: Badges de status automáticas para cada cliente:
  - 🟢 **Novo** (verde): Clientes com 1 pedido
  - 🔵 **Recorrente** (azul): Clientes com mais de 1 pedido
  - 🟡 **VIP** (amarelo): Clientes com mais de 1 pedido + mais de R$ 500 gastos
- **Corrigido**: Filtros "Novos" e "Recorrentes" agora funcionam independentemente da busca
- **Melhoria**: Botões de ação (Histório e WhatsApp) sempre visíveis
- **Desabilitado**: Dropdown de bairros temporariamente desabilitado (dados não disponíveis)

### 🔒 Segurança

#### Validação Zod - Server Actions
Adicionada validação de schema com Zod nas seguintes actions:

| Action | Schema Utilizado |
|--------|------------------|
| `login` | `LoginSchema` |
| `upsertProduct` | `ProductSchema` |
| `upsertCategory` | `CategorySchema` |
| `upsertInsumo` | `InsumoSchema` |
| `upsertCustomer` | `CustomerUpsertSchema` (novo) |
| `updateOrderStatus` | `OrderStatusSchema` |
| `saveHorariosFuncionamento` | `HorariosArraySchema` (novo) |

#### Rate Limiting
Implementado rate limiting para ações sensíveis:

| Ação | Limite | Janela |
|------|--------|--------|
| Login | 5 tentativas | 15 minutos |
| Upsert Customer | 10 tentativas | 1 minuto |
| Update Order Status | 30 atualizações | 1 minuto |

#### Logging de Auditoria
Adicionado `logAction` para rastrear:
- Criação de clientes
- Atualização de clientes
- Alteração de status de pedidos
- Exclusão de produtos
- Salvamento de categorias

### 📝 Novos Schemas (lib/validations.ts)

```typescript
// Horários de Funcionamento
export const HorarioSchema = z.object({
    dia_semana: z.coerce.number().int().min(0).max(6),
    hora_abertura: z.string().regex(/^\d{2}:\d{2}$/),
    hora_fechamento: z.string().regex(/^\d{2}:\d{2}$/),
    fechado_o_dia_todo: z.boolean().default(false),
});

// Customer Upsert
export const CustomerUpsertSchema = z.object({
    telefone: z.string().min(10),
    nome: z.string().min(2),
    bairro_entrega: z.string().optional(),
    endereco_completo: z.string().optional(),
});
```

### 🐛 Correções de Bugs

1. **Dashboard Chart**: Barras não apareciam devido a cálculo de altura incorreto
2. **Customer Filters**: Filtros misturavam com a busca por texto
3. **Currency Input**: Corrigido problema na conversão de moeda (remoção de pontos decimais)

### 📁 Arquivos Modificados

- `components/dashboard-overview.tsx` - Correção do gráfico
- `components/customer-base.tsx` - Filtros, badges, UI
- `app/actions/customers.ts` - Validação Zod, rate limiting
- `app/actions/orders.ts` - Validação Zod, rate limiting
- `app/actions/horarios.ts` - Validação Zod
- `lib/validations.ts` - Novos schemas

### 🔧 Tecnologias

- **Zod**: Validação de schema tipada
- **Rate Limiting**: Proteção contra brute force em memória
- **Audit Logging**: Rastreamento de ações críticas

---

## [1.0.0] - Versão Inicial

### Funcionalidades Base
- Sistema de autenticação com JWT
- Gestão de produtos e categorias
- Sistema de pedidos com expedição
- Controle de insumos e ficha técnica
- Gestão de clientes
- Cardápio público
- Integração WhatsApp (Evolution API)
