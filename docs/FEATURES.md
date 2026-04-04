# 💎 Funcionalidades Completas

> Este documento descreve todas as funcionalidades operacionais do ZapFlow.

---

## 📊 Painel de Controle (Dashboard)

- **Métricas em Tempo Real**: Faturamento total, número de pedidos, ticket médio
- **Gráfico de Vendas**: Evolução por hora (timezone UTC-3 Brasília)
- **Top 5 Produtos**: Ranking dos itens mais vendidos
- **Pedidos Recentes**: Lista em tempo real com status atualizado

---

## 📦 Kanban de Expedição

| Coluna | Descrição |
|--------|------------|
| Pendentes | Pedidos novos aguardando processamento |
| Preparando | Pedidos em produção |
| Pronto | Pedidos prontos para retirada/entrega |
| Entregue | Pedidos finalizados |

**Recursos:**
- Arrastar pedidos entre colunas
- Notificação WhatsApp automática ao cliente
- Alerta de estoque insuficiente (badge vermelho)
- Criação de pedidos manuais (presenciais/telefone)
- Impressão de comprovantes

---

## 🍕 Gestão de Cardápio

### Produtos
- Cadastro com nome, preço, descrição, imagem
- Controle de disponibilidade (disponível/indisponível)
- Vínculo com categorias
- Filtros por categoria, disponibilidade
- Busca por nome ou código
- Cadastro em massa de complementos
- Input de moeda (R$) com formatação automática
- **Produtos Compostos**: Pizzas meio-a-meio, combos montáveis

### Categorias
- CRUD completo integrado ao modal de produtos
- Ordenação customizable
- Controle de visibilidade

---

## 🧪 Controle de Insumos (Estoque)

### Ficha Técnica
- Vincule insumos a produtos (receitas)
- Dedução automática ao finalizar pedido
- Verificação de disponibilidade antes de aceitar pedido
- Reposição rápida de estoque

### Configuração
- Ativar/desativar globalmente por empresa
- Controle por insumo: nome, quantidade, unidade, estoque mínimo, custo

---

## 🎁 Sistema de Complementos

| Tipo | Comportamento |
|------|----------------|
| Únicos | Permite apenas 1 seleção |
| Múltiplos | Permite múltiplas selections |

- Grupos de complementos (ex: Bebidas, Adicionais)
- Vincular grupos a produtos específicos
- Cadastro em massa
- Preços individuais por complemento

---

## 🏷️ Cupons de Desconto

- **Tipos**: Percentual (%) ou Valor Fixo (R$)
- **Validação Automática**: No checkout do cardápio público
- **Limite de Uso**: Controle máximo de utilizações
- **Validade**: Período configurável
- **Valor Mínimo**: Pedido mínimo para применения
- **Segurança**: Limitador para não permitir desconto negativo

---

## ❤️ Programa de Fidelidade

- **Acumulação**: Pontos porreal gasto (ex: 1 ponto por R$ 1,00)
- **Resgate**: Descontos ou itens grátis
- **Histórico**: Saldo e movimentações por cliente
- **Aplicação Automática**: No checkout

---

## 👥 Base de Clientes (CRM)

- **Cadastro Automático**: Via telefone no primeiro pedido
- **Histórico Completo**: Todos os pedidos do cliente
- **Dados**: Nome, telefone, endereço, bairro
- **Busca**: Por nome ou WhatsApp
- **Recorrência**: Identificação de clientes frequentes

---

## 🚚 Gestão de Entregas

### Taxas por Bairro
- Taxa fixa por região/bairro

### Cálculo Automático
- Integração Google Maps API
- Distância em km × Valor/km
- Raio máximo de entrega

### Taxas Fixas
- Taxa de serviço
- Taxa de embalagem

---

## 👨‍✈️ Gestão de Entregadores

- **Cadastro**: Nome, telefone, veículo, CPF
- **Status**: Disponível/Ocupado/Offline
- **Atribuição**: Vincular pedidos a drivers
- **Entregas do Dia**: Contador automático
- **Histórico**: Análise de desempenho

---

## 🌐 Cardápio Online Público

**URL**: `/menu/[slug]`

### Recursos:
- Visualização de produtos em tempo real
- Carrinho de compras completo
- Aplicação de cupons
- Cálculo de taxa de entrega por endereço
- Programa de fidelidade integrado
- Formas de pagamento: PIX, Dinheiro (troco), Cartão
- Design responsivo (mobile-first)

---

## 📱 Módulo do Entregador

**URL**: `/driver`

### Recursos:
- Login separado (telefone como senha)
- Lista de entregas atribuídas
- Atualização de status (em andamento → finalizar)
- Contador de entregas do dia

---

## 🔐 Segurança

- Autenticação JWT com cookies httpOnly
- Rate limiting em tentativas de login
- Sanitização de inputs (XSS/SQL Injection)
- Broken Access Control corrigido (OWASP A01)
- Logging de segurança com mascaramento de dados

---

## ⚙️ Configurações

### Empresa
- Nome fantasia
- Dados de contato (telefone, e-mail)
- Dados PIX (chave, recebedor)
-CNPJ/opcional

### Operação
- Horários de funcionamento (por dia da semana)
- Conexão Evolution API (instância WhatsApp)

---

## 🔔 Notificações

- Alertas sonoros para novos pedidos
- Notificações WhatsApp automáticas por status
- Preview no painel de expedição