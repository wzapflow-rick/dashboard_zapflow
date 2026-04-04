# 🏗️ Arquitetura Técnica

> Este documento descreve a arquitetura, estrutura de código e decisões técnicas do ZapFlow.

---

## 🎯 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 15 (App Router)                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pages       │  │    API       │  │  Server      │      │
│  │  (React)      │  │   Routes     │  │   Actions    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│                    Middleware (Auth + HTTPS)                 │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    lib/                              │    │
│  │  session.ts | validations.ts | logger.ts | api.ts   │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                        NocoDB (REST API)                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
                   Evolution API
                          ↓
                      WhatsApp
```

---

## 📁 Estrutura de Diretórios

```
zapflow/
├── app/                    # Next.js App Router
│   ├── actions/           # Server Actions (backend logic)
│   │   ├── auth.ts        # Login, registro, sessão
│   │   ├── orders.ts      # Pedidos e expedição
│   │   ├── products.ts    # Gestão de produtos
│   │   ├── coupons.ts     # Cupons e descontos
│   │   ├── delivery.ts    # Taxas e cálculo
│   │   ├── drivers.ts     # Entregadores
│   │   └── ...
│   ├── api/               # API Routes
│   │   └── track/[orderId]/
│   ├── menu/[slug]/       # Cardápio público
│   ├── driver/            # Módulo entregador
│   ├── dashboard/         # Painel administrativo
│   └── login/              # Autenticação
│
├── components/            # Componentes React
│   ├── menu/              # Componentes do cardápio
│   ├── expedition/        # Kanban de expedição
│   ├── layout/            # Header, Sidebar
│   └── ui/                # Componentes universais
│
├── hooks/                 # React Hooks customizados
│   ├── use-menu-data.ts
│   ├── use-cart-checkout.ts
│   ├── use-delivery-calc.ts
│   └── use-loyalty.ts
│
├── lib/                   # Utilitários e configurações
│   ├── session.ts         # JWT (jose)
│   ├── validations.ts     # Zod schemas + sanitização
│   ├── logger.ts          # Logging estruturado
│   ├── api.ts             # Axios instance
│   └── db.ts              # Configurações de banco
│
├── docs/                  # Documentação
│   ├── FEATURES.md
│   ├── SECURITY.md
│   ├── ARCHITECTURE.md
│   └── DEPLOY.md
│
└── database/              # Scripts SQL
    ├── entregadores.sql
    └── loyalty_and_coupons.sql
```

---

## 🔧 Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Framework | Next.js | 15.x |
| UI | React | 19.x |
| Estilização | Tailwind CSS | 4.x |
| Animações | Motion | 12.x |
| Validação | Zod | - |
| Auth | jose (JWT) | 6.x |
| Hash | bcryptjs | 3.x |
| HTTP | Axios | 1.x |
| Banco | NocoDB | Cloud/On-prem |
| WhatsApp | Evolution API | 2.x |

---

## 🔐 Autenticação e Sessão

### Fluxo JWT

```
1. Usuário faz login → auth.ts:login()
2. Servidor valida credenciais contra NocoDB
3. Gera JWT com payload: { userId, email, empresaId, role, onboarded }
4. Armazena em cookie httpOnly (24h)
5. Middleware verifica sessão em todas as rotas protegidas
```

### Cookies

```typescript
(await cookies()).set('session', session, {
    expires,
    httpOnly: true,        // Não acessível via JS
    secure: isProduction,  // HTTPS apenas em produção
    sameSite: 'strict',     // Prevenção CSRF
    path: '/',
});
```

---

## 🗄️ NocoDB - Camada de Dados

### Tabelas Principais

| Tabela | ID NocoDB | Função |
|--------|-----------|--------|
| empresas | `mrlxbm1guwn9iv8` | Lojistas/restaurantes |
| produtos | `mu3kfx4zilr5401` | Cardápio |
| categorias | `mv81fy54qtamim2` | Categorias de produtos |
| pedidos | `m2ic8zof3feve3l` | Pedidos |
| clientes | `mfpwzmya0e4ej1k` | Clientes |
| entregadores | `mhevb5nu9nczggv` | Drivers |
| cupons | `myfkyl2km6bvp4p` | Cupons de desconto |
| taxas_entrega | `m0f4c9g15bbd257` | Taxas por bairro |

### Padrão de Fetch

```typescript
async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${TABLE_ID}${endpoint}`;
    return fetch(url, {
        ...options,
        headers: {
            'xc-token': NOCODB_TOKEN,
            'Content-Type': 'application/json',
        },
    });
}
```

---

## 🎣 Server Actions

O ZapFlow usa **Next.js Server Actions** para comunicação segura com o banco:

```typescript
// app/actions/orders.ts
'use server';

export async function getOrders() {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');
    
    const res = await nocoFetch(`/records?where=(empresa_id,eq,${user.empresaId})`);
    const data = await res.json();
    return data.list;
}
```

**Benefícios:**
- Execução no servidor (segurança)
- Tipagem automática (TypeScript)
- Invalidation de cache automática (`revalidatePath`)

---

## 🎨 Estado da Aplicação

### Context API (Client State)

```typescript
// components/menu/cart-context.tsx
// Carrinho de compras global
// useCart() hook para acesso
```

### Server Actions (Server State)

```typescript
// products, orders, coupons, etc.
// Dados buscados diretamente do servidor
// Sem necessidade de Redux/Zustand
```

---

## 🔄 Fluxo de Dados

### Pedido: Criação → Expedição → Finalização

```
1. Cliente acessa /menu/[slug]
2. Adiciona itens ao carrinho
3. Seleciona endereço → calcula entrega
4. Aplica cupom (se houver)
5. Finaliza pedido → POST para NocoDB
6. Painel administrativo recebe pedido
7. Expedição move entre colunas
8. Cliente recebe notificação WhatsApp
9. Pedido finalizado → deduce estoque
10. Driver atualiza status → entrega concluída
```

---

## 🌐 Rotas Públicas vs Protegidas

### Públicas
- `/` — Landing
- `/login` — Login lojista
- `/menu/[slug]` — Cardápio público
- `/track/[orderId]` — Rastreamento
- `/driver/login` — Login entregador

### Protegidas (Middleware)
- `/dashboard/**` — Requer autenticação
- `/onboarding` — Requer sessão

---

## 🚀 Performance

| Otimização | Implementação |
|------------|----------------|
| Server Components | Páginas renderizadas no servidor |
| Static Generation | Páginas públicas (menu, track) |
| Image Optimization | Next.js Image (se configurado) |
| Revalidation | Cache com revalidatePath |
| Code Splitting | Automático via Next.js |

---

## 🧪 Testes

Consulte [TESTES.md](../TESTES.md) para roteiro de testes funcionais.

---

## 📦 Deployment

Consulte [DEPLOY.md](./DEPLOY.md) para instruções de deployment.