---
product_landing_hero:
 - title: Integre Checkout Transparente e personalize toda a experiência
 - message: Ofereça pagamentos seguros em seu site com uma API flexível do Mercado Pago, sem redirecionamentos para outro site.
 - image: https://http2.mlstatic.com/storage/dx-devsite/docs-assets/custom-upload/2025/8/26/1758910958313-overviewmlbpt.png
 - benefit_icon: pay
 - benefit_title: Para pagamentos online
 - benefit_icon: categories
 - benefit_title: Integração avançada
 - benefit_icon: link
 - benefit_title: Sem redirecionamento
 - benefit_icon: edit
 - benefit_title: Personalização total
 - info: Busca opções sem desenvolvimento? Explore [mais soluções](/developers/pt/docs#online-payments).
---

---
product_landing_what_it_offers:
 - title: O que oferece
 - message: Combine diferentes funcionalidades para garantir a segurança e a conversão das operações.
 - benefit_title: Personalização e segurança
 - benefit_bullet: Desenvolva um checkout personalizado de acordo com as suas preferências.
 - benefit_bullet: Obtenha dados de compras por cartão com segurança e menor burocracia, permitindo a certificação PCI de forma simplificada.
 - benefit_title: Flexibilidade para integrar
 - benefit_bullet: Adapte às suas necessidades de negócio.
 - benefit_bullet: Escolha como as transações serão processadas: [manual ou automaticamente](/developers/pt/docs/checkout-api-orders/integration-model#bookmark_modos_de_processamento_de_orders).
 - benefit_title: Otimização dos pagamentos
 - benefit_bullet: Ofereça um processo de compra com poucas etapas.
 - benefit_bullet: Finalização de compra de forma prática e segura.
---

---
product_landing_how_works:
 - title: Como funciona
 - message: O cliente escolhe o produto e todo o processo de compra e pagamento é feito dentro da loja com a segurança do Mercado Pago, sem sair do seu site.
 - sub_title: Processo de pagamento
 - image: https://http2.mlstatic.com/storage/dx-devsite/docs-assets/custom-upload/2025/4/5/1746473018715-overvieworderspt.gif
 - image_text: Consulte as taxas de processamento
 - image_text_link: /developers/pt/support/37740 
 - list_title: O comprador seleciona os produtos ou serviços desejados em sua loja.
 - list_title: Na tela de pagamento, deve selecionar um dos meios de pagamento integrados em seu checkout.
 - list_title: Em seguida, informa os dados necessários e finaliza a compra sem sair do ambiente da sua loja.
 - list_title: Após as APIs de Mercado Pago processarem o pagamento, a compra é confirmada.
 - button_description: Como integrar
 - button_link: /developers/pt/docs/checkout-api-orders/create-application
---

---
product_landing_what_differentiates:
 - title: Quais os diferenciais
 - message: Compare nossos checkouts e escolha qual se adequa melhor ao seu negócio. Consulte as [taxas](/developers/pt/support/37740).
 - highlight_text: Você está aqui
 - column_image: https://http2.mlstatic.com/storage/dx-devsite/docs-assets/custom-upload/2025/8/26/1758910958313-overviewmlbpt.png
 - column_product: Checkout Transparente 
 - column_button_text: Como integrar
 - column_button_link: /developers/pt/docs/checkout-api-orders/overview#:~:text=UY-,Como,-integrar
 - column_product_svg_image: checkout-bricks-pt
 - column_product: Checkout Bricks
 - column_button_text: Ir ao resumo
 - column_button_link: /developers/pt/docs/checkout-bricks/landing
 - column_product_svg_image: checkout-pro-pt
 - column_product: Checkout Pro
 - column_button_text: Ir ao resumo
 - column_button_link: /developers/pt/docs/checkout-pro/overview
 - line_text: Esforço de integração
 - line_type: dots
 - line_values: 5|3|2
 - line_text: Nível de personalização
 - line_type: dots
 - line_values: 5|3|2
 - line_text: Design pronto para configurar
 - line_type: check
 - line_values: false|true|true
 - line_text: Experiência de pagamento
 - line_type: text
 - line_values: No seu site|No seu site|No Mercado Pago
 - line_text: Meios de pagamento
 - line_type: text
 - line_values: Cartão de crédito, Pix, boleto e cartão de débito virtual Caixa | Cartão de crédito, Pix, boleto, cartão de débito virtual Caixa, Conta Mercado Pago e Linha de Crédito | Cartão de crédito, Pix, boleto, cartão de débito virtual Caixa, Conta Mercado Pago e Linha de Crédito 
 - line_text: Disponibilidade por país
 - line_type: sites
 - line_values: mlb, mla, mlm, mlc, mco, mpe, mlu|all|all
---

---
product_landing_how_integrate:
 - title: Como integrar
 - sub_title: Conheça as etapas necessárias para integrar esta solução.
 - requirement_title: Pré-requisitos
 - requirement_table_title: Conta de usuário Mercado Pago
 - requirement_table_list: Você precisa criar um usuário no Mercado Pago (ou no Mercado Livre) para ter uma [conta de vendedor](https://www.mercadopago[FAKER][URL][DOMAIN]/hub/registration/landing).
 - requirement_table_title: Chave Pix
 - requirement_table_list: Caso queira oferecer pagamentos via Pix, é necessário ter as [chaves Pix cadastradas](https://www.youtube.com/watch?v=60tApKYVnkA).
---

|||column1|||
---
product_landing_how_integrate:
 - list_title: Processo de integração
 - list_item: Criar uma aplicação a partir de [Suas integrações](/developers/panel/app)
 - list_item: Configurar o ambiente de desenvolvimento
 - list_item: Configurar os meios de pagamento desejados
 - list_item: Configurar as notificações de pagamento
 - list_item: Testar sua integração
 - list_item: Medir a qualidade da integração
 - list_item: Subir em produção
 - button_description: Quero começar a integrar
 - button_link: /developers/pt/docs/checkout-api-orders/create-application
---
|||column2|||
<div class="mermaid-overview">
  <pre class="mermaid">
flowchart TD
  A[Suas integrações] --> B[Criar uma aplicação]
  B --> C[Configurar o ambiente de desenvolvimento]
  C --> D[Configurar meio de pagamento]
  D --> E[Configurar notificações de pagamento]
  E --> F[Testar sua integração]
  F --> G{O teste foi bem-sucedido?}
  G -- Não --> H[Corrigir configuração] --> F
  G -- Sim --> I[Medir a qualidade da integração]
  I --> J{O que deseja fazer?}
  J -- Subir em produção --> K[Subir em produção]
  J -- Configurar outro meio de pagamento --> D
  </pre>
</div>
|||

---
product_landing_hero:
 - title: Integre Assinaturas e configure cobranças recorrentes
 - message: Esta solução permite que seus clientes assinem produtos e serviços, realizando pagamentos recorrentes de forma automática.
 - benefit_icon: to-agree
 - benefit_title: Gestão ágil
 - benefit_icon: recurring-payments
 - benefit_title: Cobranças recorrentes
 - benefit_icon: laptop
 - benefit_title: Periodicidade personalizável
 - benefit_icon: protected-purchase
 - benefit_title: Tentativas automáticas de cobrança
 - info: Busca opções sem desenvolvimento? Explore [mais soluções](/developers/pt/docs#online-payments).
---

---
product_landing_what_it_offers:
 - title: O que oferece
 - message: Realize cobranças recorrentes, automatizadas e com uma experiência simples para seus clientes, aumentando sua conversão e faturamento.
 - benefit_title: Conversão
 - benefit_bullet: Cobrança ágil com os meios de pagamento salvos no Mercado Pago.
 - benefit_bullet: Opção de pagar sem conta do Mercado Pago.
 - benefit_bullet: Meios de pagamento online e offline, como Pix e boleto bancário. 
 - benefit_bullet: Ofereça um período de testes para que seus clientes possam conhecer seu serviço.
 - benefit_title: Aprovação de pagamentos
 - benefit_bullet: Tentativas automáticas se uma cobrança for recusada.
 - benefit_bullet: Atualização automática do status dos cartões pelas principais bandeiras.
 - benefit_title: Personalização
 - benefit_bullet: Frequência de cobrança personalizável: semanal, mensal ou anual.
 - benefit_bullet: Redirecione para uma URL personalizável após a aprovação do pagamento inicial.
 - benefit_bullet: Crie assinaturas para grupos ou personalize para cada cliente.
 - benefit_bullet: Permita que assinantes escolham quanto pagar - ideal para doações.
 - benefit_title: Segurança contra fraudes
 - benefit_bullet: Ferramentas de prevenção de fraudes e verificação de identidade do cliente.
---

---
product_landing_how_works:
 - title: Como funciona
 - message: Você cria uma assinatura por meio da nossa API definindo a frequência desejada, e compartilha o link de pagamento no seu site ou diretamente com seus clientes. Após o primeiro pagamento via Mercado Pago as cobranças seguintes ocorrem automaticamente, sem a necessidade de envio de lembretes.
 - sub_title: Processo de cobrança
 - image: https://http2.mlstatic.com/storage/dx-devsite/docs-assets/custom-upload/2025/5/12/1749741479820-subscriptionspt.gif
 - image_text: Quero começar a integrar
 - image_text_link: /developers/pt/docs/subscription-plans/create-subscription-plan
 - list_title: O comprador acessa o link da assinatura que você enviou.
 - list_title: Em seguida, é redirecionado para o formulário de pagamento, onde é possível escolher entre usar uma conta Mercado Pago ou continuar sem conta.
 - list_title: No formulário, é possível selecionar o meio de pagamento desejado - seja um já salvo na conta ou um novo a ser adicionado.
 - list_title: Após concluir o pagamento, o cliente passa a estar inscrito na assinatura e será cobrado de acordo com a periodicidade definida.
 - button_description: Começar a integrar
 - button_link: /developers/pt/docs/subscriptions/integration-configuration/subscription-associated-plan
---

---
product_landing_what_differentiates:
 - title: Quais os diferenciais
 - message: Compare nossas soluções de pagamento online e escolha a que melhor se adapta ao seu negócio. Consulte as [taxas](https://www.mercadopago[FAKER][URL][DOMAIN]/ajuda/33399).
 - columns_amount: 3
 - column_product: Assinaturas
 - column_button_text: Como criar
 - column_button_link: /developers/pt/docs/subscriptions/overview
 - column_product: Link de pagamento
 - column_button_text: Ir para o site
 - column_button_link: https://www.mercadopago[FAKER][URL][DOMAIN]/ferramentas-para-vender/link-de-pagamento
 - column_product: Planos de assinatura
 - column_button_text: Ir para o resumo
 - column_button_link: /developers/pt/docs/subscription-plans/create-subscription-plan
 - line_text: Esforço de integração
 - line_type: dots
 - line_values: 3|1|1
 - line_text: Nível de personalização
 - line_type: dots
 - line_values: 4|1|4
 - line_text: Experiência de pagamento
 - line_type: text
 - line_values: Ambiente Mercado Pago|Ambiente Mercado Pago|Ambiente Mercado Pago
 - line_text: Pagamentos recorrentes
 - line_type: check
 - line_values: true|false|true
 - line_text: Meios de pagamento
 - line_type: text
 - line_values: Dinheiro em conta, Pix, cartão de crédito ou débito, Línea de crédito, boleto.|Dinheiro em conta, Pix, cartão de crédito ou débito, Línea de crédito, boleto.|Dinheiro em conta, Pix, cartão de crédito ou débito, Línea de crédito, boleto.
 - line_text: Disponibilidade por país
 - line_type: sites
 - line_values: all|all|all
---

---
product_landing_how_integrate:
 - title: Como integrar
 - sub_title: Conheça as etapas necessárias para integrar esta solução.
 - requirement_title: Requisitos prévios
 - requirement_table_title: Conta de vendedor
 - requirement_table_list: Para integrar Checkout Pro, você precisa acessar o Mercado Pago e [criar uma conta de vendedor](https://www.mercadopago[FAKER][URL][DOMAIN]/hub/registration/landing).
 - requirement_table_title: Aplicação do Mercado Pago
 - requirement_table_list: Crie sua aplicação em [Suas integrações](/developers/pt/docs/subscriptions/additional-content/your-integrations/dashboard#:~:text=No-,Painel%20do%20desenvolvedor,-%2C%20você%20encontrará%20a%20lista) e obtenha suas credenciais para se integrar com o Mercado Pago.
 - requirement_table_title: Credenciais
 - requirement_table_list: Chaves de acesso únicas com as quais identificamos uma integração em sua conta. Para mais informações, acesse a [documentação](/developers/pt/docs/subscriptions/additional-content/your-integrations/credentials).
---

|||column1|||
---
product_landing_how_integrate:
 - list_title: Processo de integração
 - list_item: Criar uma assinatura, com ou sem plano associado, por meio de chamadas à nossa API de Assinaturas.
 - list_item:Configurar a divisão proporcional, caso queira oferecê-lo.
 - list_item: Testar a integração.
 - list_item: Subir em produção.
 - button_description: Quero começar a integrar
 - button_link: /developers/pt/docs/subscriptions/integration-configuration/subscription-associated-plan
---
|||column2|||
  <pre class="mermaid">
  flowchart TD
  A[Criar uma assinatura via API]
  A --> B1["Com plano associado"]
  A --> B2["Sem plano associado"]
  B1 --> C["Testar a integração"]
  B2 --> C
  C --> D["Subir em produção"]
  </pre>
|||