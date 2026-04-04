# 🚀 Instalação e Deployment

> Guia completo para configurar e executar o ZapFlow em produção.

---

## 📋 Pré-requisitos

| Requisito | Versão Mínima |
|-----------|---------------|
| Node.js | 18.x |
| NPM | 9.x |
| NocoDB | Qualquer versão |
| Evolution API | 2.x |

---

## 1️⃣ Clone e Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/zapflow.git
cd zapflow

# Instale dependências
npm install
```

---

## 2️⃣ Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto:

```env
# ===========================================
# 🔐 SEGURANÇA - IMPORTANTE
# ===========================================
# Generate uma chave forte com pelo menos 32 caracteres:
# openssl rand -base64 32
JWT_SECRET=sua-chave-secreta-aqui-muito-longa

# ===========================================
# 🗄️ NOCODB (Banco de Dados)
# ===========================================
NOCODB_URL=https://sua-instancia.nocodb.com
NOCODB_TOKEN=seu-token-nocodb

# ===========================================
# 💬 EVOLUTION API (WhatsApp)
# ===========================================
EVOLUTION_URL=https://evo.sua-instancia.com.br
EVOLUTION_API_KEY=sua-chave-api-evolution

# ===========================================
# 🖼️ IMGBB (Hospedagem de Imagens)
# ===========================================
IMGBB_API_KEY=sua-chave-imgbb

# ===========================================
# 🗺️ GOOGLE MAPS (Entregas)
# ===========================================
GOOGLE_MAPS_API_KEY=sua-chave-google-maps
```

### ⚠️ Importante

| Variável | Requisito | Notas |
|----------|-----------|-------|
| `JWT_SECRET` | **OBRIGATÓRIO em produção** | Mínimo 32 caracteres |
| `NOCODB_URL` | Obrigatório | URL completa com https |
| `NOCODB_TOKEN` | Obrigatório | Token de acesso API |

---

## 3️⃣ Configuração do NocoDB

### Tabelas Necessárias

O ZapFlow utiliza as seguintes tabelas no NocoDB:

| Nome | ID | Descrição |
|------|-----|-----------|
| empresas | `mrlxbm1guwn9iv8` | Cadastro de lojistas |
| produtos | `mu3kfx4zilr5401` | Cardápio |
| categorias | `mv81fy54qtamim2` | Categorias |
| pedidos | `m2ic8zof3feve3l` | Pedidos |
| clientes | `mfpwzmya0e4ej1k` | Clientes |
| entregadores | `mhevb5nu9nczggv` | Drivers |
| cupons | `myfkyl2km6bvp4p` | Descontos |
| taxas_entrega | `m0f4c9g15bbd257` | Taxas por bairro |

### Estrutura das Tabelas

Consulte `database/` para scripts SQL de exemplo.

---

## 4️⃣ Executar em Desenvolvimento

```bash
npm run dev
```

Acesse: `http://localhost:3000`

---

## 5️⃣ Build para Produção

```bash
# Build otimizado
npm run build

# Iniciar produção
npm start
```

---

## 6️⃣ Deployment (Vercel)

### Deploy Automático

1. Faça push para GitHub
2. Importe o projeto na Vercel
3. Configure as variáveis de ambiente
4. Deploy automático em cada push

### Variáveis na Vercel

Adicione todas as variáveis do `.env` no painel da Vercel.

---

## 7️⃣ Segurança em Produção

### Checklist Pré-Produção

- [ ] `JWT_SECRET` definido com 32+ caracteres
- [ ] HTTPS forçado (Vercel faz automaticamente)
- [ ] Variáveis de ambiente configuradas na plataforma
- [ ] Rate limiting ativo (já implementado)
- [ ] Logs de segurança configurados

### Scripts de Auditoria

```bash
# Verificar vulnerabilidades
npm run security:audit

# Verificar dependências desatualizadas
npm run security:deps
```

---

## 8️⃣ Troubleshooting

### Erro: "JWT_SECRET is required"

```bash
# Gere uma chave
openssl rand -base64 32

# Defina no .env ou variável de ambiente
export JWT_SECRET="sua-chave-gerada"
```

### Erro: "NocoDB API Error"

- Verifique se a URL está correta (https://...)
- Confirme que o token está válido
- Verifique as permissões da API token

### Erro: "Too many requests"

- Rate limiting ativo (5 tentativas/15min)
- Aguarde 15 minutos ou limpe o cache

---

## 📚 Documentação Relacionada

- [FEATURES.md](./FEATURES.md) — Funcionalidades
- [SECURITY.md](./SECURITY.md) — Auditoria OWASP
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Arquitetura técnica
- [TESTES.md](../TESTES.md) — Roteiro de testes

---

## 🆘 Suporte

Abra uma **Issue** no GitHub para dúvidas ou problemas.