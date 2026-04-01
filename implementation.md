Preciso reestruturar completamente a lógica de Produtos e Grupos do ZapFlow. A estrutura atual é muito rígida e não atende a complexidade de negócios de culinária (pizzarias, açaíterias, etc.), que exigem produtos fracionados (metade/metade), combos e controle de estoque proporcional. Ignore a lógica atual de produtos e opcionais; vamos reconstruir essa arquitetura do zero com foco em 'Sistema de Slots'."

1. Nova Arquitetura de Dados (Hierarquia):

    Sabores/Itens Base (A Biblioteca): Crie uma entidade independente chamada 'Itens Base'. Nela, o lojista cadastra apenas o sabor (ex: Calabresa) com seu preço de custo, preço sugerido e ficha técnica de insumos. Esse item não é vendido sozinho, ele é um componente.

    Produtos Recipientes (O Container): O 'Produto' agora é um container (ex: Pizza Média, Copo de Açaí 500ml, Barca de Sushi). Ele define o preço base do recipiente e quantos Slots de Fracionamento ele possui.

2. Lógica de Grupos e Slots (O Core):

    Configuração de Slots: Ao criar um Grupo de Opcionais, devo poder definir:

        Tipo de Grupo: 'Fracionado' (divide o produto principal) ou 'Adicional' (soma ao produto).

        Quantidade de Slots: (Ex: 2 para pizza meio-a-meio, 3 para 1/3 de pizza).

        Regra de Precificação: 'Cobrar pelo mais caro', 'Média de preços' ou 'Soma total'.

    Cálculo Automático de Proporção: O sistema deve calcular o Fator de Proporção automaticamente com base nos slots ocupados. Se o cliente escolhe 2 sabores em um container de 2 slots, o sistema deve entender que o consumo de insumos de cada sabor é 0.5 (50%).

3. Regras de Negócio e Estoque:

    Dedução Inteligente: A baixa no estoque deve respeitar o fator de proporção no momento em que o pedido for 'Finalizado'.

    Validação de Seleção: No cardápio online, o cliente só pode finalizar a escolha se preencher os slots mínimos configurados pelo lojista.

4. Interface do Usuário (UX do Lojista):

    Drag & Drop de Sabores: O lojista deve conseguir 'importar' sabores da 'Biblioteca' para dentro de um Produto (ex: arrastar o sabor 'Calabresa' para dentro da 'Pizza G' e da 'Pizza M' sem ter que cadastrar tudo de novo).

    Visão Simplificada: Substitua campos manuais de '0.33' ou '0.5' por seletores visuais de frações.

5. Objetivo Final:
"O resultado deve ser um sistema onde o lojista cadastra o sabor uma única vez e o utiliza em múltiplos tamanhos de produtos, definindo apenas como o preço e o estoque devem se comportar em cada container. Refatore o banco de dados e as rotas de API para suportar essa relação pai-filho (Container -> Grupos -> Itens Base).