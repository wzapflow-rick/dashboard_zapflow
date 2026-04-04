# 🧪 Checklist de Testes - Novas Funcionalidades

> Roteiro de testes para validar as funcionalidades implementadas em 04/04/2026

---

## 1. Avaliação de Pedido (Feedback)

### 📱 Fluxo do Cliente

| # | Teste | Passo a Passo | Resultado Esperado |
|---|-------|---------------|-------------------|
| 1.1 | **Receber link após entrega** | Finalize um pedido como "entregue" no sistema | Cliente recebe WhatsApp com link de avaliação |
| 1.2 | **Acessar página de avaliação** | Clique no link recebido | Abre página com 2 perguntas (Comida + Entrega) |
| 1.3 | **Selecionar nota comida** | Toque nas estrelas (1-5) | Estrella fica dourada, texto muda (Ruim → Excelente) |
| 1.4 | **Selecionar nota entrega** | Toque nas estrelas (1-5) | Estrella fica dourada |
| 1.5 | **Adicionar comentário** | Digite no campo de texto | Texto é digitado normalmente |
| 1.6 | **Enviar avaliação** | Clique em "Enviar Avaliação" | Página mostra "Obrigado!" com animação |
| 1.7 | **Avaliação duplicada** | Tente avaliar o mesmo pedido novamente | Mostrar "Obrigado!" ou erro amigável |
| 1.8 | **Avaliação sem nota** | Clique em enviar sem selecionar estrelas | Botão desabilitado ou erro |

### 🖥️ Painel do Lojista

| # | Teste | Passo a Passo | Resultado Esperado |
|---|-------|---------------|-------------------|
| 1.9 | **Ver avaliações** | Acesse endpoint `/api/ratings` ou crie página | Lista de avaliações com notas |
| 1.10 | **Média de notas** | Calcule média das avaliações | Média comida + média entrega |

---

## 2. Gerador de QR Code PDF

### 🖥️ Configurações do Lojista

| # | Teste | Passo a Passo | Resultado Esperado |
|---|-------|---------------|-------------------|
| 2.1 | **Acessar seção QR Code** | Dashboard → Configurações → QR Code | Seção carrega com QR preview |
| 2.2 | **QR Code gerado** | Aguarde carregamento | QR Code aparece com link do cardápio |
| 2.3 | **Link do cardápio** | Verifique o campo de texto | URL completa está correta |
| 2.4 | **Copiar link** | Clique no botão de copiar | Link copiado + toast "Link copiado!" |
| 2.5 | **Baixar PDF** | Clique em "Baixar PDF" | PDF é baixado automaticamente |
| 2.6 | **PDF abertura** | Abra o PDF baixado | PDF abre corretamente |
| 2.7 | **PDF conteúdo** | Verifique o PDF | Nome da loja + QR Code + link estão presentes |
| 2.8 | **Testar QR** | Escaneie o QR com celular | Abre o cardápio da empresa |

---

## 3. Upselling (Cross-selling)

### 📱 Cardápio Público

| # | Teste | Passo a Passo | Resultado Esperado |
|---|-------|---------------|-------------------|
| 3.1 | **Upsell no carrinho** | Adicione itens ao carrinho, espere 2s | Sugestões aparecem "Que tal adicionar?" |
| 3.2 | **Adicionar via upsell** | Clique em sugestão no carrinho | Item adicionado + toast |
| 3.3 | **Upsell no modal** | Clique em produto → abra modal | Sugestões "Combina bem com" no rodapé |
| 3.4 | **Adicionar do modal** | Clique em sugestão no modal | Item adicionado + modal fecha |
| 3.5 | **Upsell não mostra produto atual** | Abra produto X | X não aparece nas sugestões |

---

## 4. Correções de Bugs

| # | Teste | Passo a Passo | Resultado Esperado |
|---|-------|---------------|-------------------|
| 4.1 | **Editar produto** |Dashboard → Cardápio → Editar produto | Salva sem erro NaN |
| 4.2 | **Excluir insumo** | Dashboard → Insumos → Excluir | Insumo excluído com sucesso |
| 4.3 | **Repor estoque** | Dashboard → Insumos → Repor | Estoque atualizado sem erro 404 |

---

## 📝 Resultado do Teste

Preencha após testar:

| Funcionalidade | Status | Observações |
|----------------|--------|-------------|
| Avaliação - WhatsApp | ⬜ Não testado / ⬛ Testado | |
| Avaliação - Página | ⬜ Não testado / ⬛ Testado | |
| QR Code - Seção | ⬜ Não testado / ⬛ Testado | |
| QR Code - PDF | ⬜ Não testado / ⬛ Testado | |
| Upsell - Carrinho | ⬜ Não testado / ⬛ Testado | |
| Upsell - Modal | ⬜ Não testado / ⬛ Testado | |
| Bug - Editar produto | ⬜ Não testado / ⬛ Testado | |
| Bug - Excluir insumo | ⬜ Não testado / ⬛ Testado | |
| Bug - Repor estoque | ⬜ Não testado / ⬛ Testado | |

---

## ⚠️ Pré-requisitos para Testar

1. ✅ NocoDB configurado e acessível
2. ✅ Tabela `avaliacoes` criada (ou criar via API)
3. ✅ Evolution API enviando WhatsApp
4. ✅ Cardápio público funcionando

---

*Última atualização: 04/04/2026*