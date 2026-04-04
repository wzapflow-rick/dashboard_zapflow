# 📋 Tasks - ZapFlow

> Este arquivo documenta o progresso das implementações, correções e pendências do projeto.

---

## 🚀 Em Andamento

### Upselling / Cross-selling
- **Objetivo**: Mostrar sugestões contextuais "Quem comprou isso, também levou..." e "Adicione por apenas R$ X"
- **Status**: ✅ Implementado
- **Implementado**:
  - [x] Upsell no carrinho (produtos por palavras-chave)
  - [x] Sugestões no modal de produto (Cross-selling)
  - [ ] Cross-selling baseado nos itens do carrinho (pendente)
  - [ ] Sugestões "complete seu pedido" no checkout (pendente)

---

## ✅ Concluídos

### Avaliação de Pedido (Feedback)
- **Status**: ✅ Implementado
- **Descrição**: Após status "Entregue", cliente recebe link para avaliar comida e entrega (1-5 estrelas)
- **Arquivos**: `app/actions/ratings.ts`, `app/rating/[empresaId]/[pedidoId]/page.tsx`, `app/api/ratings/`
- **Integração**: link enviado automaticamente via WhatsApp após entrega

### Gerador de QR Code PDF
- **Status**: ✅ Implementado
- **Descrição**: Botão em Configurações → QR Code para gerar PDF com QR do cardápio
- **Arquivos**: `components/qr-code-generator.tsx`, adicionado em `app/dashboard/settings/page.tsx`
- **Funcionalidades**: Preview QR, link copiável, download PDF para impressão

### Segurança (OWASP)

### Segurança (OWASP)
- [x] Broken Access Control - verificação de ownership
- [x] Sanitização reforçada contra XSS/SQL
- [x] Sistema de logging estruturado
- [x] Limite de desconto em cupons

### Correções de Bugs
- [x] Editar produto (erro NaN) - category_id nullable
- [x] Excluir insumo (erro 422) - adicionado id no body
- [x] Repor estoque (erro 404) - adicionado id no body

### Documentação
- [x] README.md principal com navegação
- [x] docs/FEATURES.md
- [x] docs/SECURITY.md
- [x] docs/ARCHITECTURE.md
- [x] docs/DEPLOY.md
- [x] docs/TESTES.md

---

## ⚠️ Pendente (Ação Necessária)

| # | Item | Severidade | Observação |
|---|------|------------|------------|
| 1 | Credenciais .env expostas | 🔴 Crítica | Regenerar todas as chaves |
| 2 | JWT_SECRET fraco | 🔴 Crítico | Trocar por chave aleatória |
| 3 | Logout não redireciona | 🟡 Médio | auth.ts precisa ajustar |

---

## 📅 Histórico de Atualizações

- **04/04/2026**: Avaliação de Pedido + QR Code PDF implementados
- **04/04/2026**: Upselling no modal de produto implementado
- **04/04/2026**: Auditoria OWASP + documentação reestruturada
- **04/04/2026**: Correção bugs produtos/insumos