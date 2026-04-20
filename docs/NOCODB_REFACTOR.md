# Refatoração do NocoDB

## Visão Geral

A comunicação com o NocoDB foi completamente refatorada para centralizar o acesso, remover IDs hardcoded espalhados pelo código e melhorar a manutenibilidade do projeto.

### O que mudou?

1. **Cliente Centralizado (`lib/nocodb.ts`)**: Todas as requisições para o NocoDB agora passam por um único cliente que gerencia headers, tratamento de erros e parsing de JSON.
2. **Constantes Centralizadas (`lib/constants.ts`)**: Todos os IDs de tabelas do NocoDB foram movidos para um único arquivo. Não há mais IDs espalhados pelos arquivos de actions.
3. **Remoção de `nocoFetch`**: A função `nocoFetch` que era duplicada em mais de 20 arquivos foi removida e substituída pelos métodos do cliente `noco`.

## Como usar o novo cliente

O novo cliente exporta métodos padronizados para as operações CRUD mais comuns:

```typescript
import { noco } from '@/lib/nocodb';
import { PEDIDOS_TABLE_ID } from '@/lib/constants';

// 1. Listar registros (com filtros, ordenação e paginação)
const pedidos = await noco.list(PEDIDOS_TABLE_ID, {
  where: `(empresa_id,eq,${empresaId})~and(status,eq,pendente)`,
  sort: '-id',
  limit: 50
});

// 2. Buscar um único registro por ID
const pedido = await noco.findById(PEDIDOS_TABLE_ID, 123);

// 3. Buscar o primeiro registro que satisfaz uma condição
const config = await noco.findOne(CONFIG_TABLE_ID, {
  where: `(empresa_id,eq,${empresaId})`
});

// 4. Criar um novo registro
const novoPedido = await noco.create(PEDIDOS_TABLE_ID, {
  empresa_id: 1,
  cliente_nome: 'João',
  valor_total: 50.00
});

// 5. Atualizar um registro (o objeto DEVE conter o id)
await noco.update(PEDIDOS_TABLE_ID, {
  id: 123,
  status: 'finalizado'
});

// 6. Deletar um registro
await noco.delete(PEDIDOS_TABLE_ID, 123);
```

## Vantagens da nova abordagem

- **DRY (Don't Repeat Yourself)**: O código de fetch não é mais repetido em dezenas de arquivos.
- **Tratamento de Erros Unificado**: Todos os erros da API do NocoDB são tratados de forma consistente, lançando a exceção `NocoDBError`.
- **Tipagem Forte**: O cliente suporta Generics, permitindo tipar os retornos das chamadas.
- **Fácil Manutenção**: Se a URL ou a forma de autenticação do NocoDB mudar, basta alterar em um único lugar (`lib/nocodb.ts`).
- **Segurança**: Os IDs das tabelas não estão mais expostos em múltiplos arquivos, facilitando a auditoria.

## Próximos Passos

- Implementar cache mais agressivo para tabelas de leitura frequente (como categorias e produtos).
- Adicionar tipagem completa para todas as tabelas do NocoDB.
- Implementar retry automático para falhas temporárias de rede.
