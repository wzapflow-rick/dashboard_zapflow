# Prompt — Feature: Campanhas Automáticas de WhatsApp (ZapFlow)

Cole este prompt inteiro no Qwen antes de começar a implementação.

---

## CONTEXTO DO PROJETO

Você está trabalhando no **ZapFlow**, um Micro-SaaS de delivery (Next.js 15, TypeScript, TailwindCSS, NocoDB via REST API, Evolution API para WhatsApp). O sistema já tem: autenticação JWT, multi-tenant (por `empresa_id`), Kanban de pedidos, clientes, cupons, fidelidade e integração com WhatsApp.

### Stack
- **Framework**: Next.js 15 App Router + TypeScript
- **Estilo**: TailwindCSS
- **Banco**: NocoDB (REST API) — **não é SQL direto, são chamadas HTTP**
- **WhatsApp**: Evolution API
- **Auth**: JWT via `lib/session.ts` com `requireAdmin()`

### Padrão de chamada ao NocoDB (OBRIGATÓRIO seguir este padrão):
```ts
// GET lista
const res = await fetch(`${process.env.NOCODB_URL}/api/v1/db/data/noco/{projectId}/{tableId}`, {
  headers: { 'xc-token': process.env.NOCODB_TOKEN! }
})

// POST criar registro
await fetch(`${process.env.NOCODB_URL}/api/v1/db/data/noco/{projectId}/{tableId}`, {
  method: 'POST',
  headers: { 'xc-token': process.env.NOCODB_TOKEN!, 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})

// PATCH atualizar
await fetch(`${process.env.NOCODB_URL}/api/v1/db/data/noco/{projectId}/{tableId}/{id}`, {
  method: 'PATCH', ...
})

// DELETE (NocoDB exige body com array)
await fetch(`${process.env.NOCODB_URL}/api/v1/db/data/noco/{projectId}/{tableId}/bulk`, {
  method: 'DELETE',
  body: JSON.stringify([{ id, Id: id }])
})
```

### IDs das tabelas já existentes no NocoDB:
| Tabela | ID |
|---|---|
| Empresas | `mrlxbm1guwn9iv8` |
| Usuarios | `m3hu4490tp0yra3` |
| Clientes | `mfpwzmya0e4ej1k` |
| Pedidos | `m2ic8zof3feve3l` |
| Cupons | `m9xq8mvh3fcbi8v` |

> **ATENÇÃO**: Para as 2 novas tabelas que você vai criar, o lojista precisará criar manualmente no NocoDB e depois colar o ID no `.env`. Use as variáveis `NOCODB_TABLE_CAMPANHAS` e `NOCODB_TABLE_DISPAROS` (instruções no final).

---

## O QUE IMPLEMENTAR

### Objetivo
Uma página `/dashboard/campanhas` onde o lojista configura campanhas de mensagens automáticas via WhatsApp. O N8N vai consumir uma API do sistema para buscar as configurações e o histórico.

---

## PARTE 1 — BANCO DE DADOS (NocoDB)

Crie as instruções para o lojista criar **2 novas tabelas** no NocoDB com os seguintes campos:

### Tabela: `campanhas_config`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | Auto-increment | PK |
| `empresa_id` | Text | ID da empresa (multi-tenant) |
| `tipo` | Text | `reengajamento`, `cupom`, `pos_pedido`, `horario`, `data_especial`, `produto_destaque` |
| `ativo` | Checkbox | Liga/desliga a campanha |
| `nome` | Text | Nome amigável ex: "Reengajamento 7 dias" |
| `gatilho_dias` | Number | Para reengajamento: dias sem pedido (ex: 3, 7, 14) |
| `horario_envio` | Text | Hora do disparo ex: "10:00" |
| `dias_semana` | Text | JSON array ex: `["seg","ter","qua","qui","sex"]` |
| `desconto_percentual` | Number | % de desconto para campanhas com cupom |
| `variante_1` | Long Text | Texto da variante 1 (com variáveis `{{nome_cliente}}` etc.) |
| `variante_2` | Long Text | Texto da variante 2 |
| `variante_3` | Long Text | Texto da variante 3 |
| `variante_4` | Long Text | Texto da variante 4 |
| `max_envios_semana` | Number | Máximo de mensagens por cliente por semana (anti-spam) |
| `criado_em` | DateTime | Criação |
| `atualizado_em` | DateTime | Última atualização |

### Tabela: `campanhas_disparos`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | Auto-increment | PK |
| `empresa_id` | Text | ID da empresa |
| `campanha_id` | Number | ID da campanha que gerou o disparo |
| `cliente_id` | Number | ID do cliente que recebeu |
| `telefone` | Text | Número enviado |
| `variante_usada` | Number | Qual variante foi usada (1, 2, 3 ou 4) |
| `mensagem_enviada` | Long Text | Texto final após substituição das variáveis |
| `status` | Text | `enviado`, `erro`, `ignorado` |
| `erro_detalhe` | Text | Detalhe do erro se houver |
| `enviado_em` | DateTime | Timestamp do envio |

---

## PARTE 2 — SERVER ACTIONS

Crie o arquivo `/app/actions/campanhas.ts` com as seguintes funções:

```ts
// Todas as funções devem:
// 1. Chamar requireAdmin() do lib/session.ts
// 2. Filtrar sempre por empresa_id da sessão (multi-tenant)
// 3. Usar process.env.NOCODB_TABLE_CAMPANHAS e NOCODB_TABLE_DISPAROS
// 4. Retornar { success: boolean, data?: any, error?: string }

export async function getCampanhas(): Promise<CampanhaConfig[]>
// GET todas campanhas da empresa logada

export async function createCampanha(data: CampanhaFormData): Promise<Result>
// POST nova campanha com empresa_id da sessão

export async function updateCampanha(id: number, data: Partial<CampanhaFormData>): Promise<Result>
// PATCH campos específicos (ex: só ativo: true/false)

export async function deleteCampanha(id: number): Promise<Result>
// DELETE campanha (bulk delete NocoDB)

export async function toggleCampanha(id: number, ativo: boolean): Promise<Result>
// PATCH só o campo ativo

export async function getDisparos(campanhaId?: number): Promise<DisparoLog[]>
// GET histórico de disparos, opcionalmente filtrado por campanha
// Ordenar por enviado_em DESC, limit 100

export async function getDisparosStats(): Promise<DisparoStats>
// Retorna: total_enviados, total_erros, total_clientes_alcancados (distinct)
// nos últimos 30 dias para a empresa logada

// Endpoint público para o N8N (não precisa de auth, mas valida uma API key)
export async function getCampanhasParaN8N(empresaId: string, apiKey: string): Promise<CampanhaConfig[]>
// Retorna campanhas ativas da empresa
// Valida apiKey contra process.env.N8N_WEBHOOK_SECRET

export async function registrarDisparo(data: {
  empresaId: string
  campanhaId: number
  clienteId: number
  telefone: string
  varianteUsada: number
  mensagemEnviada: string
  status: 'enviado' | 'erro' | 'ignorado'
  erroDetalhe?: string
}): Promise<Result>
// POST registro de disparo — chamado pelo N8N após enviar
```

### Tipos TypeScript necessários:
```ts
interface CampanhaConfig {
  id: number
  empresa_id: string
  tipo: 'reengajamento' | 'cupom' | 'pos_pedido' | 'horario' | 'data_especial' | 'produto_destaque'
  ativo: boolean
  nome: string
  gatilho_dias?: number
  horario_envio?: string
  dias_semana?: string[] // parse do JSON
  desconto_percentual?: number
  variante_1: string
  variante_2?: string
  variante_3?: string
  variante_4?: string
  max_envios_semana: number
  criado_em: string
  atualizado_em: string
}

interface DisparoLog {
  id: number
  empresa_id: string
  campanha_id: number
  cliente_id: number
  telefone: string
  variante_usada: number
  mensagem_enviada: string
  status: 'enviado' | 'erro' | 'ignorado'
  erro_detalhe?: string
  enviado_em: string
}

interface DisparoStats {
  total_enviados: number
  total_erros: number
  total_clientes_alcancados: number
}
```

---

## PARTE 3 — ROTA DE API PARA O N8N

Crie `/app/api/n8n/campanhas/route.ts`:

```ts
// GET /api/n8n/campanhas?empresa_id=xxx&api_key=yyy
// Retorna campanhas ativas para o N8N consumir
// Valida api_key === process.env.N8N_WEBHOOK_SECRET
// Retorna JSON com array de CampanhaConfig

// POST /api/n8n/disparos
// Body: { api_key, empresa_id, campanha_id, cliente_id, telefone, variante_usada, mensagem_enviada, status, erro_detalhe? }
// Registra o disparo no histórico
// Valida api_key === process.env.N8N_WEBHOOK_SECRET
```

---

## PARTE 4 — PÁGINA DO DASHBOARD

Crie `/app/dashboard/campanhas/page.tsx` com o seguinte layout e comportamento:

### Layout geral
- Header: título "Campanhas automáticas" + botão "Nova campanha" (abre modal)
- Cards de métricas no topo (3 cards): Total enviados (30 dias) / Clientes alcançados / Taxa de erro
- Lista de campanhas configuradas
- Tabela de histórico de disparos (últimos 50)

### Cards de campanha (lista)
Cada campanha na lista deve mostrar:
- Toggle (switch) para ativar/desatigar — chama `toggleCampanha()` on change
- Nome da campanha
- Badge com o tipo (`reengajamento`, `cupom`, etc.) — cada tipo com cor diferente
- Resumo: horário de envio + dias da semana configurados
- Quantas variantes tem configuradas (ex: "4 variantes")
- Botão editar (abre modal preenchido) + botão excluir (confirm dialog)

### Modal de criação/edição
O modal deve ter os seguintes campos:

**Seção 1 — Identificação**
- Nome da campanha (input text, obrigatório)
- Tipo (select com as 6 opções — ao mudar, adapta campos abaixo)
- Ativo (toggle switch)

**Seção 2 — Quando disparar** (campos variam por tipo)
- `reengajamento`: input numérico "Dias sem pedido para disparar"
- `cupom` / `produto_destaque`: checkboxes dos dias da semana + input de horário
- `pos_pedido`: select "Minutos após a entrega" (30, 60, 120)
- `horario`: select "Momento" (ao abrir, 1h antes de fechar, ao fechar)
- `data_especial`: select da data (aniversário, Dia das Mães, etc.)

**Seção 3 — Configurações**
- Máximo de mensagens por cliente por semana (input numérico, default: 2)
- Desconto percentual (só aparece se tipo = `cupom` ou `data_especial` ou `produto_destaque`)

**Seção 4 — Mensagens (variantes)**
- 4 textareas lado a lado em abas (Variante 1, 2, 3, 4)
- Apenas Variante 1 é obrigatória
- Abaixo de cada textarea: chips clicáveis com as variáveis disponíveis
  - `{{nome_cliente}}`, `{{ultimo_pedido}}`, `{{dias_ausente}}`, `{{cupom}}`, `{{desconto}}`, `{{nome_loja}}`, `{{produto_destaque}}`, `{{pontos}}`
  - Ao clicar no chip, insere a variável na posição do cursor no textarea

**Chips de variáveis — quais aparecem por tipo:**
- `reengajamento`: nome_cliente, ultimo_pedido, dias_ausente, nome_loja
- `cupom`: nome_cliente, cupom, desconto, nome_loja
- `pos_pedido`: nome_cliente, ultimo_pedido, pontos, produto_destaque, nome_loja
- `horario`: nome_cliente, nome_loja
- `data_especial`: nome_cliente, cupom, desconto, nome_loja
- `produto_destaque`: nome_cliente, produto_destaque, cupom, desconto, nome_loja

### Tabela de histórico
Colunas: Data/Hora | Campanha | Cliente | Telefone | Variante | Status | Mensagem (truncada, expandível)
- Badge colorido no status: verde=enviado, vermelho=erro, cinza=ignorado
- Paginação simples (anterior/próximo, 20 por página)

### Sidebar
Adicione o item "Campanhas" na sidebar (`/components/sidebar.tsx`) com ícone de megafone (Megaphone do lucide-react), posicionado após "Marketing/Cupons" (growth).

---

## PARTE 5 — VARIÁVEIS DE AMBIENTE

Adicione ao `.env.example`:

```env
# Campanhas automáticas
NOCODB_TABLE_CAMPANHAS=           # ID da tabela campanhas_config no NocoDB
NOCODB_TABLE_DISPAROS=            # ID da tabela campanhas_disparos no NocoDB
N8N_WEBHOOK_SECRET=               # Chave secreta compartilhada com o N8N
```

---

## PARTE 6 — INSTRUÇÕES PARA O LOJISTA (gere como comentário no topo de `/app/dashboard/campanhas/page.tsx`)

```
SETUP NECESSÁRIO:
1. No NocoDB, criar tabela "campanhas_config" com os campos descritos em /docs/CAMPANHAS.md
2. Copiar o ID da tabela e colar em NOCODB_TABLE_CAMPANHAS no .env
3. Criar tabela "campanhas_disparos" e colar ID em NOCODB_TABLE_DISPAROS
4. Gerar uma string aleatória segura e colocar em N8N_WEBHOOK_SECRET
5. No N8N, configurar o webhook com a mesma chave
```

---

## RESTRIÇÕES IMPORTANTES

1. **Multi-tenant**: SEMPRE filtrar por `empresa_id` da sessão. Nunca retornar dados de outra empresa.
2. **Seguir padrão existente**: Olhe como `coupons.ts` e `loyalty.ts` fazem as chamadas ao NocoDB e siga o mesmo padrão.
3. **Sem bibliotecas novas**: Use apenas o que já está no `package.json`. Para o modal, use o padrão de dialog já existente no projeto. Para ícones, use `lucide-react` (já instalado).
4. **Server Actions**: Todas as funções de dados devem ser `'use server'`. A página pode ser client component (`'use client'`) para gerenciar estado do modal e toggles.
5. **Loading states**: Todos os botões que fazem chamadas async devem ter estado de loading (disabled + spinner).
6. **Tratamento de erro**: Exibir toast/alert de erro quando a chamada falhar.
7. **NocoDB DELETE**: Usar bulk delete com body `[{id, Id}]` conforme bug documentado.

---

## ORDEM DE EXECUÇÃO SUGERIDA

1. Criar os tipos TypeScript em `/app/actions/campanhas.ts`
2. Implementar todas as server actions
3. Criar a rota `/app/api/n8n/campanhas/route.ts`
4. Criar a página `/app/dashboard/campanhas/page.tsx`
5. Adicionar item na sidebar
6. Atualizar `.env.example`

---

## REFERÊNCIAS DO PROJETO

- Padrão de server action: `/app/actions/coupons.ts`
- Padrão de página com modal: `/app/dashboard/growth/page.tsx`
- Componente de toggle/switch: `/components/coupons-management.tsx`
- Sidebar: `/components/sidebar.tsx`
- Session/auth: `/lib/session.ts`
