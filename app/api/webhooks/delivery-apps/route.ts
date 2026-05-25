import { NextRequest, NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import { PEDIDOS_TABLE, CLIENTES_TABLE, EMPRESAS_TABLE } from '@/lib/tables';
import { notifyCustom } from '@/lib/discord';
import crypto from 'crypto';

// Plataformas suportadas
type DeliveryPlatform = 'ifood' | 'rappi' | '99food' | 'aiqfome' | 'ubereats' | 'manual' | 'outros';

interface ExternalOrderItem {
  nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao?: string;
  complementos?: Array<{
    nome: string;
    preco: number;
  }>;
}

interface ExternalOrderPayload {
  // Identificacao
  plataforma: DeliveryPlatform;
  pedido_externo_id: string;
  empresa_token: string; // Token unico da empresa para autenticacao
  
  // Cliente
  cliente_nome: string;
  cliente_telefone?: string;
  
  // Endereco
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  numero?: string;
  complemento?: string;
  referencia?: string;
  
  // Pedido
  itens: ExternalOrderItem[];
  subtotal: number;
  taxa_entrega: number;
  desconto?: number;
  valor_total: number;
  
  // Pagamento
  tipo_pagamento: string;
  status_pagamento?: 'pendente' | 'pago';
  troco_necessario?: number;
  
  // Outros
  tipo_entrega: 'delivery' | 'retirada';
  observacoes?: string;
  data_agendamento?: string;
}

/**
 * POST /api/webhooks/delivery-apps
 * Recebe pedidos de plataformas externas (iFood, Rappi, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body: ExternalOrderPayload = await request.json();
    
    console.log('[Webhook Delivery] Pedido recebido:', {
      plataforma: body.plataforma,
      pedido_externo_id: body.pedido_externo_id,
      cliente: body.cliente_nome,
    });

    // Validar campos obrigatorios
    if (!body.empresa_token) {
      return NextResponse.json(
        { error: 'empresa_token é obrigatório' },
        { status: 400 }
      );
    }

    if (!body.plataforma || !body.pedido_externo_id) {
      return NextResponse.json(
        { error: 'plataforma e pedido_externo_id são obrigatórios' },
        { status: 400 }
      );
    }

    if (!body.itens || body.itens.length === 0) {
      return NextResponse.json(
        { error: 'O pedido deve ter pelo menos um item' },
        { status: 400 }
      );
    }

    // Buscar empresa pelo token
    const empresaResult = await pg.query(
      `SELECT id, nome_fantasia, instancia_evolution FROM ${EMPRESAS_TABLE} WHERE webhook_token = $1 LIMIT 1`,
      [body.empresa_token]
    );
    
    const empresa = empresaResult.rows?.[0] || empresaResult?.[0];
    
    if (!empresa) {
      console.log('[Webhook Delivery] Token invalido:', body.empresa_token);
      return NextResponse.json(
        { error: 'Token de empresa inválido' },
        { status: 401 }
      );
    }

    // Verificar se pedido ja existe (evitar duplicatas)
    const pedidoExistente = await pg.query(
      `SELECT id FROM ${PEDIDOS_TABLE} WHERE empresa_id = $1 AND pedido_externo_id = $2 AND origem = $3 LIMIT 1`,
      [empresa.id, body.pedido_externo_id, body.plataforma]
    );

    if (pedidoExistente.rows?.length > 0 || pedidoExistente?.length > 0) {
      console.log('[Webhook Delivery] Pedido duplicado ignorado:', body.pedido_externo_id);
      return NextResponse.json(
        { success: true, message: 'Pedido já registrado', duplicado: true },
        { status: 200 }
      );
    }

    // Criar ou atualizar cliente
    let clienteId = null;
    if (body.cliente_telefone) {
      const telefone = body.cliente_telefone.replace(/\D/g, '');
      
      const clienteExistente = await pg.query(
        `SELECT id FROM ${CLIENTES_TABLE} WHERE empresa_id = $1 AND telefone = $2 LIMIT 1`,
        [empresa.id, telefone]
      );

      if (clienteExistente.rows?.length > 0 || clienteExistente?.length > 0) {
        clienteId = clienteExistente.rows?.[0]?.id || clienteExistente?.[0]?.id;
      } else {
        // Criar novo cliente
        const novoCliente = await pg.create(CLIENTES_TABLE, {
          empresa_id: empresa.id,
          nome: body.cliente_nome,
          telefone: telefone,
          endereco: body.endereco,
          bairro: body.bairro,
          cidade: body.cidade,
          estado: body.estado,
          numero: body.numero,
          complemento: body.complemento,
          referencia: body.referencia,
          origem: body.plataforma,
        });
        clienteId = novoCliente.id;
      }
    }

    // Formatar itens para o padrao do sistema
    const itensFormatados = body.itens.map(item => ({
      nome: item.nome,
      quantidade: item.quantidade,
      preco: item.preco_unitario,
      observacao: item.observacao || '',
      complementos: item.complementos || [],
    }));

    // Criar pedido
    const novoPedido = await pg.create(PEDIDOS_TABLE, {
      empresa_id: empresa.id,
      telefone_cliente: body.cliente_telefone?.replace(/\D/g, '') || null,
      cliente_nome: body.cliente_nome,
      itens: JSON.stringify(itensFormatados),
      subtotal: body.subtotal,
      taxa_entrega: body.taxa_entrega || 0,
      desconto: body.desconto || 0,
      valor_total: body.valor_total,
      tipo_pagamento: body.tipo_pagamento,
      status_pagamento: body.status_pagamento || 'pendente',
      troco_necessario: body.troco_necessario || 0,
      endereco_entrega: body.endereco || null,
      bairro_entrega: body.bairro || null,
      cidade_entrega: body.cidade || null,
      estado_entrega: body.estado || null,
      numero_casa: body.numero || null,
      complemento: body.complemento || null,
      referencia: body.referencia || null,
      tipo_entrega: body.tipo_entrega || 'delivery',
      observacoes: body.observacoes || null,
      data_agendamento: body.data_agendamento ? new Date(body.data_agendamento) : null,
      status: 'pendente',
      origem: body.plataforma,
      pedido_externo_id: body.pedido_externo_id,
    });

    console.log('[Webhook Delivery] Pedido criado:', novoPedido.id);

    // Notificar no Discord
    await notifyCustom(
      `Pedido ${body.plataforma.toUpperCase()}`,
      `Novo pedido #${novoPedido.id} de **${body.cliente_nome}** via ${body.plataforma.toUpperCase()}\n` +
      `Valor: R$ ${body.valor_total.toFixed(2)}\n` +
      `Empresa: ${empresa.nome_fantasia}`,
      'success'
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Pedido criado com sucesso',
      pedido_id: novoPedido.id,
      pedido_externo_id: body.pedido_externo_id,
    });

  } catch (error: any) {
    console.error('[Webhook Delivery] Erro:', error);
    
    return NextResponse.json(
      { error: 'Erro interno ao processar pedido', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/delivery-apps
 * Retorna informacoes sobre a API
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook de integração com apps de entrega',
    plataformas_suportadas: ['ifood', 'rappi', '99food', 'aiqfome', 'ubereats', 'manual', 'outros'],
    documentacao: 'https://docs.wzapflow.com.br/integracoes',
  });
}
