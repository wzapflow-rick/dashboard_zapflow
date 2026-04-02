# Changelog - ZapFlow Dashboard

## [2.3.0] - 2026-04-01

### 📱 Painel do Entregador

#### Login do Entregador
- **URL**: `/driver/login`
- **Autenticação**: Email + telefone como senha
- **Sessão**: Cookie seguro com expiração de 8 horas

#### Dashboard Mobile
- **URL**: `/driver`
- **Lista de pedidos**: Pedidos atribuídos ao entregador
- **Ações**: "Iniciar Entrega" e "Confirmar Entrega"
- **Refresh**: Botão para atualizar pedidos em tempo real

#### Comissão do Entregador
- **Configuração**: Campo comissão no cadastro do entregador
- **Fallback**: 50% da taxa de entrega se não configurado
- **Registro**: Comissão salva por dia na tabela comissoes_entregadores

#### Histórico de Entregas
- **URL**: Settings > Histórico
- **Filtros**: Por entregador, período, busca por texto
- **Cards de resumo**: Total entregas, faturamento, taxas, comissões
- **Resumo por entregador**: Ranking de desempenho

### 🛵 Sistema de Entregadores

#### Cadastro de Entregadores
- **Novo**: CRUD completo de entregadores
- **Campos**: Nome, email, telefone, veículo, placa, comissão por entrega
- **Status**: Disponível / Ocupado / Offline

#### Atribuição no Kanban
- **Novo**: Dropdown para atribuir entregador aos pedidos
- **Auto-status**: Entregador fica "Ocupado" ao receber entrega
- **Liberação**: Entregador volta para "Disponível" ao finalizar

#### Notificação WhatsApp
- **Para cliente**: Link de rastreamento ao criar/atualizar pedido
- **Para entregador**: Dados da entrega ao ser atribuído
- **Formato**: Número com @s.whatsapp.net automático

#### Página de Rastreamento Pública
- **URL**: `/track/[orderId]`
- **Info**: Status, timeline, entregador, endereço, resumo
- **Auto-update**: Atualiza a cada 30 segundos

#### Teste de WhatsApp
- **URL**: Settings > Notificações
- **Botão**: "Enviar Teste" para validar conexão

### 🔧 Correções
- **Badge de entrega**: Agora detecta corretamente delivery vs retirada
- **Endereço no Kanban**: Exibe endereço completo quando disponível
- **Geocoding**: Melhor formatação de endereços brasileiros
- **Taxa fixa de entrega**: Configurável quando raio automático está desativado

---

## [2.2.0] - 2026-04-01

### 🎁 Novas Funcionalidades

#### Cupons de Desconto
- **Novo**: Sistema completo de cupons de desconto
- **Tipos**: Percentual (%) ou Valor Fixo (R$)
- **Configurações**: Valor mínimo, limite de uso, datas de validade
- **Validação**: Cupons validados automaticamente no pedido
- **Dashboard**: Estatísticas de uso de cupons

#### Programa de Fidelidade
- **Novo**: Sistema de pontos para clientes
- **Acúmulo**: Configurável pontos por real gasto
- **Resgate**: Desconto em dinheiro ou produtos gratuitos
- **Dashboard**: Ranking dos top clientes com mais pontos
- **Configuração**: Ativar/desativar, regras de acúmulo e resgate

#### 🛒 Carrinho de Compras Digital
- **Novo**: Carrinho completo no cardápio online
- **Cupom**: Input para aplicar cupom com validação em tempo real
- **Pontos**: Preview de pontos que o cliente ganhará na compra
- **Upsell**: Sugestões automáticas de produtos (bebidas, sobremesas) vindos do banco de dados
- **Quantidade**: Ajuste de quantidades antes de enviar pedido

### 📝 Novos Arquivos

- `app/actions/coupons.ts` - Server actions para cupons
- `app/actions/loyalty.ts` - Server actions para programa de fidelidade
- `components/coupons-management.tsx` - UI para gerenciar cupons
- `components/loyalty-management.tsx` - UI para programa de fidelidade
- `components/menu/cart-context.tsx` - Contexto global do carrinho
- `components/menu/cart.tsx` - Componente do carrinho com cupom, pontos e upsell
- `components/menu/menu-client-wrapper.tsx` - Wrapper com CartProvider

### 🔧 Integrações

- Cupons aplicados automaticamente no pedido quando informado
- Pontos de fidelidade adicionados quando pedido é finalizado
- Uso de cupom incrementado após finalização do pedido
- Upsell busca produtos reais do banco (bebidas, sobremesas)
- Configuração de fidelidade vem do banco de dados

### 📱 Checkout Direto do Cardápio

#### Novo Fluxo de Pedido
- **Checkout completo**: Cliente informa dados e finaliza pedido direto no cardápio
- **Cadastro automático**: Cliente é cadastrado automaticamente se não existir
- **Pagamento integrado**: PIX, Dinheiro ou Cartão
- **Sem WhatsApp obrigatório**: Pedido vai direto para o Kanban
- **Produtos salvos corretamente**: Itens com nomes e complementos visíveis no dashboard

#### Kanban - Status Pagamento Pendente
- **Nova coluna**: "Aguardando Pagamento" (laranja)
- **Fluxo**: Pagamento Pendente → Confirmar → Novos Pedidos → Preparando → Entrega → Concluído
- **Notificação sonora**: Toca som ao confirmar pagamento
- **Polling automático**: Atualiza a cada 10 segundos
- **Dinheiro pula etapa**: Pedidos em dinheiro vão direto para "Novos Pedidos"

#### Fidelidade Integrada
- **Pontos na tela de checkout**: Mostra pontos do cliente ao informar telefone
- **Notificação de desconto**: Avisa quando cliente tem 100+ pontos
- **Pontos na aba de clientes**: Coluna de pontos na lista de clientes
- **Usar pontos no pagamento**: Toggle para aplicar desconto com pontos
- **Desconto automático**: Calcula automaticamente o valor do desconto

#### Checkout Melhorado
- **Opção de Retirada**: Cliente pode escolher entre Delivery e Retirada
- **Taxa de Entrega**: R$ 5,00 para delivery, grátis para retirada
- **Detecção automática**: Pedido mostra corretamente se é delivery ou retirada

#### Kanban
- **Modal de Detalhes**: Ícone de olho para ver detalhes completos do pedido
- **WhatsApp notificações**: Mensagem enviada ao confirmar pagamento (status pendente)

#### Correções
- **Cupom desativa após limite**: Agora desativa automaticamente quando atinge limite de uso
- **Produtos salvos corretamente**: Itens com nomes e complementos visíveis no dashboard
- **Retirada vs Delivery**: Corrigido para mostrar corretamente o tipo de entrega

### 📝 Novos Arquivos

- `app/actions/public-orders.ts` - Server actions para pedidos do cardápio
- `components/menu/cart.tsx` - Carrinho com checkout completo

---

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
