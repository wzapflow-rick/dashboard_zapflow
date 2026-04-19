# 📋 Contextualização e Roadmap do Sistema de Menu - ZapFlow

Este documento detalha as mudanças implementadas no sistema de pedidos (cardápio público) e as próximas etapas sugeridas para atingir a experiência ideal de "onboarding" solicitada.

---

## ✅ O que foi implementado (Funcionalidades Atuais)

### 1. Reestruturação de Dados no Backend (`getPublicMenu`)
- **Separação Inteligente**: O sistema agora distingue automaticamente grupos de **Sabor** (fracionados/meio-a-meio) de grupos de **Adicionais** (bordas, extras, complementos).
- **Vínculo Dinâmico**: Se um sabor selecionado possuir `completamentos_ids` vinculados no banco de dados, esses adicionais são carregados automaticamente para o fluxo de escolha do cliente.
- **Hierarquia de Grupos**: Os grupos não são mais exibidos em uma lista única e confusa; eles são organizados por tipo e finalidade.

### 2. Novo Fluxo de Seleção (Estilo Onboarding)
O `MenuProductSelectionModal` foi transformado em um assistente de passos:
- **Passo 1: Sabores** — Foco total na escolha do sabor principal (Ex: Pizza M).
- **Passo 2: Adicionais** — Exibição de dropdowns ou cards com os adicionais disponíveis (Ex: Borda Recheada, Molho Extra).
- **Passo 3: Observação** — Campo final para anotações do cliente (Ex: "Sem cebola").
- **Interface**: Barra de progresso visual e botões "Continuar" e "Voltar" para guiar o usuário.

### 3. Suporte a Produtos Compostos
- O `CompositeProductModal` também foi atualizado para seguir este fluxo, permitindo que montagens complexas (combos ou pizzas com múltiplos sabores) também tenham suas etapas de adicionais respeitadas.

---

## 🛠️ O que falta e Próximos Passos (Roadmap)

Ainda existem pontos que podem ser refinados para tornar a experiência perfeita:

### 1. Gatilho Automático do Modal (Obrigatório)
- **Problema**: Atualmente, se o sistema não detectar complementos "antigos", ele pode adicionar o item direto ao carrinho sem abrir o modal.
- **Ação**: Ajustar o `MenuFilter` para que **qualquer** produto que tenha `saborGroups` ou `additionalGroups` abra obrigatoriamente o modal de seleção.

### 2. UI de Adicionais (Dropdown vs Modal)
- **Sugestão**: Implementar a opção de abrir um **sub-modal** ou um **dropdown expansível** dentro do Passo 2 para casos onde existam muitos adicionais, evitando que a tela fique muito longa.

### 3. Validação de Regras de Negócio
- **Ação**: Garantir que o botão "Finalizar" só seja habilitado se todas as escolhas obrigatórias (mínimos definidos no NocoDB) forem preenchidas em cada etapa.

### 4. Sincronização com o Dashboard Administrativo
- **Sugestão**: Adicionar um campo no dashboard de gestão de produtos para que o lojista possa definir visualmente a ordem dessas etapas para cada categoria.

---

## 🚀 Como testar as mudanças atuais
1. Acesse o cardápio público (`/menu/[slug]`).
2. Clique em um produto que possua sabores e adicionais vinculados.
3. Observe a barra de progresso no topo do modal e navegue entre as etapas usando os botões "Continuar".

---
*Documento gerado para auxiliar na continuidade do desenvolvimento do ZapFlow.*
