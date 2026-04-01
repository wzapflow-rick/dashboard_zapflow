# 🚀 ZapFlow — Roadmap de Funcionalidades

## ✅ Implementado
- Kanban de pedidos com controle de status
- Verificação de estoque antes de aceitar pedido
- Alerta de insumos insuficientes
- Botão de WhatsApp para notificar cliente
- Geração de pedido manual
- Controle de insumos (toggle opcional)
- Reposição de estoque com botão dedicado
- Gráfico "Vendas por Hora" com fuso horário corrigido
- Cardápio Online Público (/menu/[slug])
- Notificações Push com Alerta Sonoro
- **Cupons de Desconto** (percentual ou valor fixo)
- **Programa de Fidelidade** (pontos por compra, resgate de descontos)

---

## 🔄 Em Andamento

### Multi-Usuário com Permissões
> Cadastre atendentes com acesso restrito ao Kanban e Clientes. O dono mantém acesso total.
> **Requer:** criar tabela `usuarios` no NocoDB.


---

## 📋 Próximas Ideias

### 📊 Relatórios Avançados
- Seleção de períodos customizados
- Export em CSV e PDF
- Ranking de clientes por valor gasto
- Custo de insumos vs. faturamento (margem bruta por produto)

### 🖨️ Impressora Térmica
- Integração via API local com impressora térmica
- Imprimir comanda automaticamente ao aceitar um pedido no Kanban

### 📱 PWA (App Mobile)
- Transformar em Progressive Web App instalável
- Notificações mesmo com o navegador fechado
- Ícone na tela inicial do celular

### 🤖 Atendimento com IA
- Bot Gemini integrado ao WhatsApp (Evolution API)
- Responde clientes, monta pedido automaticamente
- Transfere para humano quando necessário

### 🛵 Rastreamento de Entregadores
- Cadastro de entregadores
- Atribuição de pedidos por entregador
- Link de rastreamento para o cliente

### 📣 Campanhas de Remarketing
- Envio de mensagens em massa (broadcast) via WhatsApp
- Segmentação por clientes inativos, aniversariantes, etc.
- Agendamento de campanhas automáticas

### 📦 Pedidos de Reposição de Insumos
- Ao atingir estoque mínimo, gerar alerta automático
- Sugerir quantidade a repor com base no histórico de consumo
- Exportar lista de compras

### 🔗 Integração com iFood
- Sincronizar pedidos do iFood no Kanban automaticamente
- Unificar relatórios de todas as plataformas em um único dashboard

### 🏪 Multi-Loja
- Gerenciar múltiplas filiais com um único login de gerência
- Dashboard consolidado com métricas de todas as unidades
- Cardápio compartilhado ou independente por unidade
