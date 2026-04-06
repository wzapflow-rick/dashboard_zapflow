# opencode - Memória do Projeto

## Quem sou
Sou o opencode, assistant de CLI para programação. Este é um projeto Next.js + NocoDB de dashboard para restaurante.

## Stack
- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- NocoDB (backend via API REST)
- Evolution API (WhatsApp)

## Estrutura do Projeto

### /app
- **actions/** - Server Actions (lógica backend)
  - auth.ts - Login, register, getMe, logout
  - users.ts - CRUD usuários (empresa_id, nome, email, senha_hash, role, ativo)
  - products.ts - CRUD produtos, categorias
  - orders.ts - Pedidos, status, fluxo Kanban
  - customers.ts - Clientes, CRM
  - drivers.ts - Entregadores, comissões
  - coupons.ts - Cupons de desconto
  - loyalty.ts - Programa de pontos
  - insumos.ts - Estoque/ingredientes
  - complements.ts - Complementos de produto
  - horarios.ts - Horários de funcionamento
  - whatsapp.ts - Integração WhatsApp (Evolution API)
  - evolution.ts, bot.ts - Bots
  - ratings.ts - Avaliações
  - notifications.ts - Notificações
  - public-menu.ts, public-orders.ts - API pública

- **dashboard/** - Páginas protegidas
  - page.tsx - Overview
  - users/ - Gerenciar usuários
  - menu/ - Cardápio/produtos
  - expedition/ - Kanban de pedidos
  - customers/ - Clientes
  - settings/ - Configurações
  - growth/ - Marketing/cupons
  - ratings/ - Avaliações
  - insumos/ - Estoque
  - categories/ - Categorias
  - complements/ - Complementos

- **login/** - Login/register
- **onboarding/** - Configuração inicial

### /components
- dashboard-layout.tsx, sidebar.tsx, header.tsx - Layout
- menu/ - Carrinho, produto, categoria
- expedition/ - Kanban, cards de pedido
- coupons-management.tsx
- loyalty-management.tsx
- drivers-management.tsx
- E muito mais...

### /lib
- session.ts - JWT, requireAdmin, requireRole
- validations.ts - Zod schemas
- logger.ts - Logs
- audit.ts - Auditoria
- utils.ts, api.ts - Utils

### middleware.ts
- Protege rotas /dashboard e /onboarding
- Roles: admin, atendente, cozinheiro
- Redireciona baseado em role

## IDs do NocoDB (CRÍTICO)
| Tabela | ID |
|--------|-----|
| Empresas | `mrlxbm1guwn9iv8` |
| Usuarios | `m3hu4490tp0yra3` |
| Produtos | `mu3kfx4zilr5401` |
| Categorias | `mv81fy54qtamim2` |
| Pedidos | `m2ic8zof3feve3l` |
| Clientes | `mfpwzmya0e4ej1k` |
| Entregadores | `mhevb5nu9nczggv` |
| Cupons | `m9xq8mvh3fcbi8v` |
| Loyalty | `m7fg9pyp2odct7m` |
| Insumos | (descobrir) |
| Comissões | `mq9no1mvg98994s` |
| Config Entrega | `me3vc6ngpp32dkk` |
| Histórico Entregas | `mfs71qiyhv8vlo8` |

## Bugs Já Corrigidos
1. DELETE usuário dava 404 → NocoDB precisa DELETE /records com body `[{id, Id}]`
2. Login não funcionava → campo na tabela é `senha_hash`
3. getUsers retornava vazio → usa `id` minúsculo, não `Id`
4. usuarios iam para tabela errada → ID correto `m3hu4490tp0yra3`

## Roles
- **admin** (empresa): acesso total, cria usuários, configurações
- **atendente**: Kanban + Clientes
- **cozinheiro**: só Kanban (/dashboard/expedition)

## Funcionalidades Implementadas
- ✅ Upselling/Cross-selling automático
- ✅ Avaliações de pedido (anon/identificado)
- ✅ Multi-usuário com níveis de acesso
- ✅ QR Code para divulgação
- ✅ Programa de fidelidade (pontos)
- ✅ Cupons de desconto
- ✅ Controle de estoque (insumos)
- ✅ Kanban de pedidos (expedition)
- ✅ Integração WhatsApp (Evolution API)
- ✅ Cadastro de entregadores
- ✅ Múltiplas categorias e complementos

## Pendências (opencode.md)
- ⏳ Agendamento de pedidos (pedir agora, receber às 20h)
- ⏳ Impressão térmica (ESC/POS)
- ⏳ GPS entregador em tempo real
- ⏳ Acertos financeiro do motoboy
- ⏳ Prova de entrega (foto)
- ⏳ Carrinho abandonado (30min)
- ⏳ Relatório DRE
- ⏳ PIX com webhooks
- ⏳ Modo offline/contingência

## Variáveis de Ambiente
- NOCODB_URL, NOCODB_TOKEN
- JWT_SECRET
- EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE
- NEXT_PUBLIC_BASE_URL
- NODE_ENV

---

Para recuperar contexto: ler este arquivo e o opencode.md
