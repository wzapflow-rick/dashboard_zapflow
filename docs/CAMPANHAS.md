# Configurando as Tabelas de Campanhas no NocoDB

## Tabela 1: `campanhas_config`

Crie uma nova tabela no NocoDB com o nome `campanhas_config` e adicione os seguintes campos:

| Nome do Campo | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | Auto Increment | Sim | - | Chave primária |
| `empresa_id` | Single Line Text | Sim | - | ID da empresa (multi-tenant) |
| `tipo` | Single Line Text | Sim | `reengajamento` | Tipo da campanha: `reengajamento`, `cupom`, `pos_pedido`, `horario`, `data_especial`, `produto_destaque` |
| `ativo` | Checkbox | Sim | `true` | Liga/desliga a campanha |
| `nome` | Single Line Text | Sim | - | Nome amigável, ex: "Reengajamento 7 dias" |
| `gatilho_dias` | Number | Não | - | Para reengajamento: dias sem pedido (ex: 3, 7, 14) |
| `horario_envio` | Single Line Text | Não | `10:00` | Hora do disparo, ex: "10:00" |
| `dias_semana` | Long Text | Não | - | JSON array, ex: `["seg","ter","qua","qui","sex"]` |
| `desconto_percentual` | Number | Não | `0` | Percentual de desconto para campanhas com cupom |
| `variante_1` | Long Text | Sim | - | Texto da variante 1 (com variáveis `{{nome_cliente}}` etc.) |
| `variante_2` | Long Text | Não | - | Texto da variante 2 |
| `variante_3` | Long Text | Não | - | Texto da variante 3 |
| `variante_4` | Long Text | Não | - | Texto da variante 4 |
| `max_envios_semana` | Number | Sim | `2` | Máximo de mensagens por cliente por semana (anti-spam) |
| `criado_em` | DateTime | Não | `Now` | Timestamp de criação |
| `atualizado_em` | DateTime | Não | `Now` | Timestamp da última atualização |

**Após criar a tabela**, copie o ID dela (aparece na URL ou nas configurações da tabela) e cole no `.env`:
```
NOCODB_TABLE_CAMPANHAS=SEU_ID_AQUI
```

---

## Tabela 2: `campanhas_disparos`

Crie uma nova tabela no NocoDB com o nome `campanhas_disparos` e adicione os seguintes campos:

| Nome do Campo | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `id` | Auto Increment | Sim | - | Chave primária |
| `empresa_id` | Single Line Text | Sim | - | ID da empresa |
| `campanha_id` | Number | Sim | - | ID da campanha que gerou o disparo |
| `cliente_id` | Number | Sim | - | ID do cliente que recebeu a mensagem |
| `telefone` | Single Line Text | Sim | - | Número do telefone enviado |
| `variante_usada` | Number | Sim | `1` | Qual variante foi usada (1, 2, 3 ou 4) |
| `mensagem_enviada` | Long Text | Sim | - | Texto final após substituição das variáveis |
| `status` | Single Line Text | Sim | `enviado` | Status: `enviado`, `erro` ou `ignorado` |
| `erro_detalhe` | Single Line Text | Não | - | Detalhe do erro se houver |
| `enviado_em` | DateTime | Não | `Now` | Timestamp do envio |

**Após criar a tabela**, copie o ID dela e cole no `.env`:
```
NOCODB_TABLE_DISPAROS=SEU_ID_AQUI
```

---

## Variável adicional: N8N_WEBHOOK_SECRET

Gere uma string aleatória segura (ex: 64 caracteres) e coloque no `.env`:

```
N8N_WEBHOOK_SECRET=sua_chave_secreta_aleatoria_aqui
```

Essa mesma chave deve ser configurada no N8N nos webhooks que chamam:
- `GET /api/n8n/campanhas?empresa_id=xxx&api_key=yyy`
- `POST /api/n8n/disparos` (com `api_key` no body)
