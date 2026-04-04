# 🚀 ZapFlow — Dashboard de Delivery via WhatsApp

> A solução definitiva para gestão de delivery, integrada nativamente ao WhatsApp via **Evolution API**. Transforme sua operação com controle total de pedidos, estoque e clientes em uma interface moderna e ultra-veloz.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![NocoDB](https://img.shields.io/badge/Database-NocoDB-green)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8?logo=tailwindcss)

---

## 📚 Navegação da Documentação

### 📖 [Guia Completo de Funcionalidades](docs/FEATURES.md)
Todas as funcionalidades operacionais do sistema — painéis, pedidos, produtos, estoque, cupons, fidelidade, entregadores e mais.

### 🔐 [Segurança e Auditoria OWASP](docs/SECURITY.md)
Auditoria completa de cibersegurança seguindo OWASP Top 10, vulnerabilidades corrigidas e checklist de segurança.

### 🏗️ [Arquitetura Técnica](docs/ARCHITECTURE.md)
Estrutura de código, stack tecnológica, autenticação JWT, Server Actions, NocoDB e fluxo de dados.

### 🚀 [Instalação e Deployment](docs/DEPLOY.md)
Passo a passo de configuração, variáveis de ambiente, deployment Vercel e troubleshooting.

### 🧪 [Testes e QA](docs/TESTES.md)
Roteiro completo de testes funcionais e checklist de qualidade.

---

## 💡 Visão Geral

O **ZapFlow** é um Micro-SaaS de delivery estilo iFood que permite:

- 🏪 **Gestão de Restaurantes** — Múltiplos lojistas com autenticação isolada
- 📦 **Cardápios Digitais** — Produtos, categorias, complementos e produtos compostos
- 📊 **Pedidos em Tempo Real** — Kanban de expedição com notificação WhatsApp
- 📈 **Métricas e KPIs** — Faturamento, ticket médio, produtos mais vendidos
- 🚚 **Logística de Entregas** — Taxas por bairro, cálculo via Google Maps
- 👨‍✈️ **App de Entregadores** — Área separada para drivers
- ❤️ **Fidelidade** — Programa de pontos e cupons de desconto

---

## 🛠 Stack Tecnológica

| Camada | Tecnologia |
|:-------|:-----------|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router) |
| **Interface** | [React 19](https://react.dev/) + [Tailwind CSS 4](https://tailwindcss.com/) |
| **Animações** | [Motion](https://motion.dev/) |
| **Banco de Dados** | [NocoDB](https://nocodb.com/) (API REST) |
| **WhatsApp** | [Evolution API](https://evolution-api.com/) |
| **Segurança** | JWT (jose) + BCryptJS + OWASP Top 10 |

---

## 🚀 Quick Start

```bash
# Clone e instale
git clone https://github.com/seu-usuario/zapflow.git
cd zapflow
npm install

# Configure o .env (veja docs/DEPLOY.md)
cp .env.example .env

# Execute
npm run dev
```

Acesse: `http://localhost:3000`

---

## 🔐 Segurança

Este projeto passou por **auditoria OWASP Top 10** completa. Veja os detalhes em **[SECURITY](docs/SECURITY.md)**.

---

## 📄 Licença

MIT License - Feel free to use!

---

<p align="center">
  <b>ZapFlow — Elevando o nível do seu Delivery</b><br>
  Feito com ❤️ para empreendedores que buscam excelência.
</p>