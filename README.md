# 🚀 ZapFlow — Dashboard de Delivery via WhatsApp

> A solução definitiva para gestão de delivery, integrada nativamente ao WhatsApp via **Evolution API**. Transforme sua operação com controle total de pedidos, estoque e clientes em uma interface moderna e ultra-veloz.

![Dashboard Preview](https://img.shields.io/badge/Status-100%25_Funcional-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![NocoDB](https://img.shields.io/badge/Database-NocoDB-green)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8?logo=tailwindcss)

---

## 💎 Funcionalidades (100% Operacionais)

O ZapFlow foi desenvolvido para oferecer uma experiência premium e robusta. Abaixo estão os módulos totalmente funcionais:

### 📊 Painel de Controle (Real-Time)
*   **Métricas Inteligentes**: Acompanhamento instantâneo de faturamento total, número de pedidos e ticket médio.
*   **Análise de Vendas**: Gráfico dinâmico de vendas por hora com ajuste automático para o fuso horário de Brasília (UTC-3).
*   **Performance de Produtos**: Ranking "Top 5" dos itens mais vendidos para tomadas de decisão rápidas.
*   **Monitor de Atividade**: Listagem em tempo real dos pedidos mais recentes com status atualizado.

### 📦 Kanban de Expedição (Logística)
*   **Fluxo de Trabalho Visual**: Gerenciamento de pedidos através de colunas intuitivas: `Pendentes` → `Preparando` → `Pronto` → `Entregue`.
*   **Automação WhatsApp**: Notificação automática e instantânea para o cliente a cada mudança de status do pedido.
*   **Inteligência de Estoque**: Alertas visuais imediatos caso um pedido contenha itens com insumos insuficientes.
*   **Pedidos Manuais**: Interface dedicada para registrar vendas presenciais ou por telefone diretamente no sistema.

### 🍕 Gestão de Cardápio (Produtos + Categorias)
*   **Catálogo Digital**: Cadastro completo de produtos com suporte a imagens, descrições detalhadas e controle de disponibilidade.
*   **Gestão Integrada de Categorias**: CRUD completo de categorias diretamente na aba de Produtos (modal dedicado).
*   **Filtros Avançados**: Filtrar produtos por categoria, disponibilidade e ordenar por nome, preço ou data.
*   **Busca Rápida**: Pesquisa por nome ou código do produto.
*   **Cadastro em Massa**: Atribuir complementos a vários produtos de uma vez.
*   **Formatador de Preços**: Input de moeda inteligente (R$) para evitar erros de digitação.
*   **Produtos Compostos**: Gerenciamento de combos e produtos em slot (pizzas meio a meio, montáveis).

### 🧪 Controle de Insumos (Ficha Técnica)
*   **Estoque Automatizado**: Dedução automática de insumos assim que um pedido é marcado como "Finalizado".
*   **Segurança de Venda**: O sistema verifica a disponibilidade de insumos antes de permitir o aceite do pedido, evitando rupturas.
*   **Reposição Express**: Botão de reposição rápida para atualizar níveis de estoque sem burocracia.
*   **Modo Opcional**: Ative ou desative o controle de estoque globalmente nas configurações.

### 🎁 Sistema de Complementos
*   **Grupos de Complementos**: Crie grupos como "Bebidas", "Adicionais", "Sabores".
*   **Vínculo com Produtos**: Associe complementos específicos a cada produto.
*   **Cadastro em Massa**: Atribua múltiplos complementos a vários produtos de uma só vez.

### 🏷️ Sistema de Cupons
*   **Cupons de Desconto**: Crie cupons percentuais ou valores fixos.
*   **Validação Automática**: Validação em tempo real no cardápio público.
*   **Limite de Uso**: Controle de uso máximo por cupom.

### ❤️ Programa de Fidelidade
*   **Pontos por Compra**: Clientes acumulam pontos a cada pedido.
*   **Resgate de Descontos**: Use pontos para obter descontos automaticamente.
*   **Histórico de Pontos**: Acompanhe o saldo e histórico do cliente.

### 👥 Base de Clientes (CRM)
*   **Perfil do Cliente**: Histórico completo de pedidos por cliente, incluindo datas e itens comprados.
*   **Registro Automático**: Identificação e cadastro de novos clientes a partir do telefone.
*   **Busca Inteligente**: Localize clientes rapidamente por nome ou número de WhatsApp.

### 🚚 Gestão de Entregas
*   **Taxas por Bairro**: Configure taxas específicas por região.
*   **Cálculo Automático**: Cálculo baseado em distância (R$/km) via Google Maps API.
*   **Configuração de Raio**: Defina raio máximo de entrega.
*   **Taxa de Serviço**: Controle de custos fixos como taxas de serviço e embalagem.

### 👨‍✈️ Gestão de Motoristas
*   **Cadastro de Motoristas**: Gerencie sua equipe de entrega.
*   **Histórico de Entregas**: Acompanhe desempenho individual.
*   **Relatórios**: Análise de entregas por motorista.

### ⚙️ Configurações e Personalização
*   **Identidade Visual**: Configure o nome da sua loja, dados de contato e informações de pagamento (PIX).
*   **Operação Local**: Definição flexível de horários de funcionamento em formato 24h.
*   **Conexão WhatsApp**: Integração com Evolution API para automação.

### 🌐 Cardápio Online Público
*   **Vitrine Digital**: Página exclusiva (`/menu/[slug]`) onde seus clientes podem visualizar produtos em tempo real com um design moderno e responsivo.
*   **Carrinho de Compras**: Interface completa com adição/remoção de itens.
*   **Cupons no Cardápio**: Aplicação de cupons diretamente na compra.
*   **Múltiplas Formas de Pagamento**: PIX, Dinheiro (com troco), Cartão.
*   **Cálculo de Entrega**: Taxa calculada automaticamente pelo endereço.
*   **Programa de Fidelidade**: Clientes acumulam e usam pontos na compra.

### 📱 Módulo do Motorista
*   **Área do Entregador**: Login separado para motoristas.
*   **Fila de Entregas**: Visualize entregas pendentes e em andamento.
*   **Confirmação de Entrega**: Marque entregas como concluídas.

### 🔐 Segurança e Performance
*   **Acesso Protegido**: Autenticação via JWT (JSON Web Token) com cookies `httpOnly` e criptografia BCrypt.
*   **Onboarding Simples**: Fluxo guiado para configuração inicial da loja e conexão com a Evolution API.
*   **Alertas Sonoros**: Notificações sonoras premium para garantir que nenhum novo pedido passe despercebido.

### 🏗️ Arquitetura e Código
*   **Código Modular**: Hooks reutilizáveis para lógica de negócio (filtros, checkout, entrega, fidelidade).
*   **Componentes Separados**: UI desacoplada e reutilizável.
*   **Server Actions**: Comunicação segura com o banco via Next.js Server Actions.

#### Estrutura de Hooks (`/hooks`)
| Hook | Função |
|------|--------|
| `use-menu-data.ts` | Gerencia estado de produtos, categorias e insumos |
| `use-menu-filters.ts` | Filtros, busca e paginação de produtos |
| `use-driver-tour.ts` | Tour guiado do sistema |
| `use-cart-checkout.ts` | Estado do checkout (carrinho → cliente → pagamento) |
| `use-delivery-calc.ts` | Cálculo automático de taxa de entrega |
| `use-loyalty.ts` | Sistema de fidelidade e pontos |

#### Componentes Modulares (`/components/menu`)
| Componente | Função |
|------------|--------|
| `category-modal.tsx` | Modal CRUD de categorias |
| `product-form-modal.tsx` | Formulário de produto |
| `product-table.tsx` | Tabela de produtos com ações |
| `cart.tsx` | Carrinho de compras |
| `cart-context.tsx` | Contexto global do carrinho |

---

## 📋 Documentação de Testes

Consulte o arquivo **[TESTES.md](./TESTES.md)** para o checklist completo de testes e roteiro de gravação do vídeo.

---

## 🛠 Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router) |
| **Interface** | [React 19](https://react.dev/) + [Tailwind CSS 4](https://tailwindcss.com/) |
| **Animações** | [Motion](https://motion.dev/) |
| **Banco de Dados** | [NocoDB](https://nocodb.com/) (Arquitetura REST) |
| **Vínculo WhatsApp** | [Evolution API](https://evolution-api.com/) |
| **Segurança** | Jose (JWT) + BCryptJS |

---

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18.x ou superior
- Uma instância funcional do **NocoDB**
- Uma instância da **Evolution API** configurada

### Passo a Passo
1.  **Clone o projeto**:
    ```bash
    git clone https://github.com/seu-usuario/zapflow-dashboard.git
    cd zapflow-dashboard
    ```
2.  **Instale as dependências**:
    ```bash
    npm install
    ```
3.  **Variáveis de Ambiente**:
    Crie um arquivo `.env` na raiz com as chaves:
    - `JWT_SECRET`: Sua chave secreta para as sessões.
    - `NOCODB_URL`: URL da sua API NocoDB.
    - `NOCODB_TOKEN`: Token de acesso da API.
    - `EVOLUTION_API_URL`: URL da sua Evolution API.

4.  **Inicie o sistema**:
    ```bash
    npm run dev
    ```

---

<p align="center">
  <b>ZapFlow — Elevando o nível do seu Delivery</b><br>
  Feito com ❤️ para empreendedores que buscam excelência.
</p>
