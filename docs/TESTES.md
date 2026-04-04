# 📋 Checklist de Testes - ZapFlow Dashboard

> Guia completo para testar todas as funcionalidades e gravar o vídeo de demonstração.

---

## 🎬 Roteiro Sugerido para o Vídeo

### CENA 1 - Login e Dashboard (1-2 min)
1. Acessar a URL do sistema
2. Fazer login com as credenciais
3. Mostrar o Dashboard com métricas:
   - Faturamento total
   - Número de pedidos
   - Ticket médio
   - Gráfico de vendas por hora
   - Top 5 produtos
   - Pedidos recentes

### CENA 2 - Gestão de Cardápio (3-4 min)
4. Clicar em "Cardápio" na sidebar
5. Mostrar a lista de produtos com filtros:
   - Filtrar por categoria
   - Filtrar por disponibilidade
   - Buscar produto por nome
   - Ordenar por preço/nome/data
6. Clicar em "Gerenciar Categorias"
   - Criar uma nova categoria
   - Editar uma categoria existente
   - Excluir uma categoria
7. Clicar em "Novo Produto"
   - Preencher nome, preço, descrição
   - Selecionar categoria
   - Adicionar imagem
   - Salvar o produto
8. Editar um produto existente
9. Ativar/desativar disponibilidade de um produto
10. Mostrar aba "Produtos Compostos"
    - Criar um produto composto

### CENA 3 - Controle de Insumos (2 min)
11. Clicar em "Insumos" na sidebar
12. Mostrar lista de insumos
13. Cadastrar um novo insumo
14. Repor estoque de um insumo
15. Mostrar receitas vinculadas

### CENA 4 - Expedição (2-3 min)
16. Clicar em "Expedição" na sidebar
17. Mostrar o Kanban com colunas:
    - Pendentes
    - Preparando
    - Pronto
    - Entregue
18. Arrastar um pedido entre as colunas
19. Mostrar detalhes de um pedido
20. Confirmar que o WhatsApp foi enviado (notificação)

### CENA 5 - Cardápio Público (2-3 min)
21. Abrir o cardápio público em nova aba
22. Mostrar a vitrine de produtos
23. Adicionar produtos ao carrinho
24. Aplicar um cupom de desconto
25. Preencher dados de entrega
26. Selecionar forma de pagamento
27. Finalizar pedido

### CENA 6 - Configurações (1-2 min)
28. Clicar em "Configurações" na sidebar
29. Mostrar configurações da loja:
    - Nome e dados da loja
    - Horário de funcionamento
    - Dados PIX
30. Configurações de entrega:
    - Taxas por bairro
    - Raio de entrega
31. Conexão com WhatsApp (Evolution API)

---

## ✅ Checklist Completo de Testes

### 📊 Dashboard
- [ x ] Dashboard carrega sem erros
- [ x ] Métricas são exibidas corretamente
- [ x ] Gráfico de vendas renderiza
- [ x ] Top 5 produtos aparece
- [ x ] Pedidos recentes são listados
- [ x ] Links nos pedidos funcionam
- * Não está exibindo o NOME do cliente nos ultimos pedidos, apenas o número

### 🔐 Autenticação
- [ x ] Login com credenciais válidas
- [ x ] Login com credenciais inválidas (mostra erro)
- [  ] Logout funciona ( Não feito )
- [ x ] Redirecionamento para login sem autenticação

### 🍕 Cardápio - Produtos
- [ X ] Lista de produtos carrega
- [ x ] Filtro por categoria funciona
- [ X ] Filtro por disponibilidade funciona
- [ X ] Busca por nome/código funciona
- [ X ] Ordenação funciona (nome, preço, data)
- [ X ] Paginação funciona
- [ ] Criar novo produto ( Tem muita informção, pode remover tudo que envolve os slots e o grupo de complementos, deixa somente nome, desc, categ, preco, img e pra marcar o insumos )
- [ ] Editar produto existente ( Erro Middleware Path: /dashboard/menu | Session: true | Onboarded: true
API Error: Error: Dados inválidos: Invalid input: expected number, received NaN
    at upsertProduct (app\actions\products.ts:228:13)
  226 |     if (!validated.success) {
  227 |       const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
> 228 |       throw new Error(`Dados inválidos: ${errorMsg}`);
      |             ^
  229 |     }
  230 |
  231 |     const product = validated.data;
 ⨯ Error: Dados inválidos: Invalid input: expected number, received NaN
    at upsertProduct (app\actions\products.ts:272:11)
  270 |   } catch (error: any) {
  271 |     console.error('API Error:', error);
> 272 |     throw new Error(error.message || 'Failed to save product');
      |           ^
  273 |   }
  274 | }
  275 | {
  digest: '1031022852'
}
 POST /dashboard/menu 500 in 649ms )
- [ X ] Excluir produto
- [ X ] Ativar/desativar produto
- [ ] Upload de imagem funciona ( Nao consegui testar )
- [ X ] Seleção de categoria funciona 

### 📂 Cardápio - Categorias
- [ X ] Modal "Gerenciar Categorias" abre
- [ X ] Criar nova categoria
- [X  ] Editar categoria existente
- [X ] Excluir categoria
- [X ] Lista de categorias atualiza após ações
- [X ] Categorias aparecem nos filtros

### 🧩 Produtos Compostos
- [ X ] Aba "Produtos Compostos" funciona
- [ x ] Criar produto composto ( Preço de custo não está funcionando )
- [ X ] Adicionar itens ao composto
- [ X ] Editar produto composto
- [ X ] Excluir produto composto

### 🎁 Complementos
- [ X ] Lista de grupos de complementos
- [ X ] Criar novo grupo
- [ X ] Editar grupo
- [ X ] Excluir grupo
- [ X ] Adicionar itens ao grupo
- [ X ] Vincular complementos a produtos
- [ ] Cadastro em massa de complementos ( Não tenho acesso aos produtos criados, como os refrigerantes, apenas aos produtos base )

### 🏷️ Cupons
- [ X ] Lista de cupons
- [ X ] Criar cupom percentual
- [ X ] Criar cupom valor fixo
- [ X ] Editar cupom
- [ X ] Excluir cupom
- [ X ] Validar cupom no cardápio público

### 🧪 Insumos
- [ X ] Lista de insumos carrega
- [ X ] Criar novo insumo
- [ X ] Editar insumo
- [  ] Excluir insumo ( Middleware Path: /dashboard/insumos | Session: true | Onboarded: true
NocoDB Error: 422 {"error":"ERR_REQUIRED_FIELD_MISSING","message":"Field 'Id' is required"}
API Error: Error: NocoDB API Error: 422
    at nocoFetch (app\actions\insumos.ts:51:15)
    at async deleteInsumo (app\actions\insumos.ts:120:9)
  49 |         const text = await res.text();
  50 |         console.error(`NocoDB Error: ${res.status} ${text}`);
> 51 |         throw new Error(`NocoDB API Error: ${res.status}`);
     |               ^
  52 |     }
  53 |
  54 |     return res;
 ⨯ Error: Failed to delete insumo
    at deleteInsumo (app\actions\insumos.ts:129:15)
  127 |     } catch (error) {
  128 |         console.error('API Error:', error);
> 129 |         throw new Error('Failed to delete insumo');
      |               ^
  130 |     }
  131 | }
  132 | {
  digest: '2461016099'
}
 POST /dashboard/insumos 500 in 719ms)
- [  ] Repor estoque rápido ( NocoDB Error: 404 {"error":"ERR_RECORD_NOT_FOUND","message":"Record 'unknown' not found"}
Erro ao definir novo estoque: Error: NocoDB API Error: 404
    at nocoFetch (app\actions\insumos.ts:51:15)
    at async setNovoEstoqueInsumo (app\actions\insumos.ts:227:9)
  49 |         const text = await res.text();
  50 |         console.error(`NocoDB Error: ${res.status} ${text}`);
> 51 |         throw new Error(`NocoDB API Error: ${res.status}`);
     |               ^
  52 |     }
  53 |
  54 |     return res;
 ⨯ Error: NocoDB API Error: 404
    at nocoFetch (app\actions\insumos.ts:51:15)
    at async setNovoEstoqueInsumo (app\actions\insumos.ts:227:9)
  49 |         const text = await res.text();
  50 |         console.error(`NocoDB Error: ${res.status} ${text}`);
> 51 |         throw new Error(`NocoDB API Error: ${res.status}`);
     |               ^
  52 |     }
  53 |
  54 |     return res; {
  digest: '367501249'
}
 POST /dashboard/insumos 500 in 1100ms)
- [  ] Receitas vinculadas aparecem ( Não feito )
- [ X ] Alerta de estoque baixo

### ❤️ Fidelidade
- [ X ] Configuração do programa
- [ X ] Pontos por compra configurável
- [ X ] Desconto por pontos configurável
- [ X ] Histórico de pontos do cliente
- [ X ] Resgate de pontos no checkout

### 📦 Expedição
- [ X ] Kanban carrega com pedidos
- [ X ] Colunas: Pendentes, Preparando, Pronto, Entregue
- [ X ] Arrastar pedido entre colunas
- [ X ] Modal de detalhes do pedido
- [ X ] Notificação WhatsApp ao mudar status
- [ X ] Alerta de insumos insuficientes
- [ ] Pedido manual ( Não funciona! Middleware Path: /dashboard/expedition | Session: true | Onboarded: true
NocoDB Error: 404 {"error":"ERR_TABLE_NOT_FOUND","message":"Table 'm9icndofh9z4jmi' not found"}
 ⨯ Error: NocoDB API Error: 404
    at nocoFetch (app\actions\insumos.ts:51:15)
  49 |         const text = await res.text();
  50 |         console.error(`NocoDB Error: ${res.status} ${text}`);
> 51 |         throw new Error(`NocoDB API Error: ${res.status}`);
     |               ^
  52 |     }
  53 |
  54 |     return res; {
  digest: '772577171'
}
 POST /dashboard/expedition 500 in 445ms também é importante verificar se o cliente já não tem cadastro pelo número! )

### 👥 Clientes ( * Sempre que entro na pagina ele tem duas notificações vazias )
- [ X ] Lista de clientes
- [ X ] Busca por nome/telefone
- [ X ] Histórico de pedidos do cliente
- [  ] Detalhes do cliente ( Não feito )

### 👨‍✈️ Motoristas
- [ X ] Lista de motoristas
- [ X ] Cadastrar motorista
- [X ] Editar motorista
- [X ] Excluir motorista
- [ X ] Histórico de entregas por motorista

### 🚚 Entregas
- [ X ] Configuração de taxas
- [  ] Taxas por bairro ( Remover, mas deixar ali para caso precise )
- [ X] Cálculo automático por distância
- [X ] Raio máximo configurável
- [ X] Taxa de serviço/embalagem

### 🌐 Cardápio Público
- [ X ] Página carrega corretamente
- [ X ] Produtos são exibidos
- [ X ] Categorias organizam produtos
- [ X ] Adicionar ao carrinho
- [ X ] Remover do carrinho
- [ X ] Alterar quantidade
- [X  ] Aplicar cupom 
- [ X ] Calcular entrega por endereço ( Dar uma tip para caso não consiga calcular, dizer para não usar Rua, Praça, Avenida, sempre abreviar R. Pr. Av. )
- [X ] Selecionar pagamento (PIX, Dinheiro, Cartão)
- [ X] Finalizar pedido
- [ x] Página de sucesso

### 📱 Módulo Motorista
- [ X] Login do motorista
- [ X] Lista de entregas pendentes
- [ X] Confirmar entrega
- [ X] Logout

### ⚙️ Configurações
- [ x ] Dados da loja
- [ x ] Horário de funcionamento
- [x ] Dados de pagamento (PIX)
- [ x] Integração WhatsApp
- [ x] Configurações de entrega

### 🔔 Notificações
- [x ] Alertas sonoros funcionam ( funciona mas está no lugar errado, eu quero que quando chegue em pendente ele notifique, e quando chegue em novos pedidos também, mas que sejam diferentes )
- [ x] Toast de sucesso/erro
- [ x] Notificações de novos pedidos

---

## 🎯 Dicas para a Gravação

1. **Prepare dados de teste**: Tenha alguns produtos, categorias e cupons já criados
2. **Use resolução 1920x1080**: Para melhor qualidade no vídeo
3. **Navegue devagar**: Dê tempo para o viewer acompanhar
4. **Destaque as animações**: O sistema tem transições suaves que valorizam
5. **Mostre o mobile**: Se possível, mostre o cardápio público no celular
6. **Grave em segments**: Você pode gravar cada seção separadamente e editar depois

---

## 📝 Dados de Teste Sugeridos

### Categorias
- Lanches
- Bebidas
- Sobremesas
- Combos

### Produtos Exemplo
- X-Burger - R$ 25,90
- Pizza Calabresa - R$ 45,90
- Refrigerante 350ml - R$ 6,90
- Batata Frita - R$ 15,90

### Cupons Exemplo
- DESCONTO10 - 10% de desconto
- FRETEGRATIS - R$ 10,00 fixo
- PRIMEIRACOMPRA - 15% de desconto

### Insumos Exemplo
- Pão de Hamburger
- Carne Bovina
- Queijo Mussarela
- Alface
- Tomate

---

*Última atualização: Abril 2026*
