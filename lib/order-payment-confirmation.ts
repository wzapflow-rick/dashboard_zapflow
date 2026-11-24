import { pg } from '@/lib/postgres';
import { notifyNewOrder } from '@/lib/push';
import { sendOrderStatusMessage, sendOwnerNewOrderMessage } from '@/lib/whatsapp';

/**
 * Promove um pedido público para a fila de produção uma única vez.
 * A atualização condicional torna webhook, retorno do pagamento e polling idempotentes.
 */
export async function confirmPublicOrderPayment(orderId: number): Promise<boolean> {
  if (!Number.isInteger(orderId) || orderId <= 0) return false;

  const result = await pg.query(
    `UPDATE pedidos
        SET status_pagamento = 'aprovado', status = 'pendente'
      WHERE id = $1 AND status_pagamento IS DISTINCT FROM 'aprovado'
      RETURNING *`,
    [orderId],
  );
  const order = result.rows?.[0] as Record<string, any> | undefined;
  if (!order) return false;

  const empresaId = Number(order.empresa_id);
  const customerPhone = String(order.telefone_cliente || '').trim();
  const tasks: Promise<unknown>[] = [];

  if (customerPhone) {
    tasks.push(
      sendOrderStatusMessage(customerPhone, orderId, 'aprovado', empresaId, order.tipo_entrega)
        .catch((error) => console.error('[OrderPayment] Falha no WhatsApp de confirmação ao cliente:', error)),
    );
  }

  tasks.push(
    notifyNewOrder(empresaId, {
      id: orderId,
      clienteNome: order.cliente_nome,
      total: order.valor_total,
      origem: order.origem,
    }),
  );

  try {
    const empresa = await pg.findById('empresas', empresaId) as Record<string, any> | null;
    const ownerPhone = String(empresa?.telefone_loja || '').trim();
    if (empresa?.notificar_pedido_whatsapp === true && ownerPhone) {
      let itens: any[] = [];
      try {
        const parsed = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens;
        if (Array.isArray(parsed)) itens = parsed;
      } catch {
        console.warn(`[OrderPayment] Itens do pedido ${orderId} não puderam ser lidos para o aviso ao lojista`);
      }

      const pagamentoLabel: Record<string, string> = {
        pix: 'PIX',
        dinheiro: 'Dinheiro',
        cartao: 'Cartão',
      };
      const formaPagamento = String(order.forma_pagamento || order.tipo_pagamento || '');

      tasks.push(
        sendOwnerNewOrderMessage({
          ownerPhone,
          orderId,
          total: Number(order.valor_total || 0),
          clienteNome: String(order.cliente_nome || 'Cliente'),
          clienteTelefone: String(order.telefone_cliente || ''),
          isDelivery: order.tipo_entrega === 'delivery',
          endereco: String(order.endereco_entrega || ''),
          itens,
          pagamento: pagamentoLabel[formaPagamento] || formaPagamento,
          observacoes: String(order.observacoes || ''),
        }).catch((error) => console.error('[OrderPayment] Falha no WhatsApp de novo pedido ao lojista:', error)),
      );
    }
  } catch (error) {
    console.error('[OrderPayment] Falha ao consultar preferências do lojista:', error);
  }

  await Promise.allSettled(tasks);
  return true;
}
