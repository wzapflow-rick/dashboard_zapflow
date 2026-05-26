/**
 * Servico de integracao com iFood
 * Documentacao: https://developer.ifood.com.br
 * 
 * IMPORTANTE: Esta integracao requer aprovacao do iFood como parceiro integrador
 */

const IFOOD_API_URL = 'https://merchant-api.ifood.com.br';
const IFOOD_AUTH_URL = 'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token';

interface IFoodCredentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

interface IFoodOrder {
  id: string;
  reference: string;
  shortReference: string;
  createdAt: string;
  type: 'DELIVERY' | 'TAKEOUT' | 'INDOOR';
  merchant: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    name: string;
    phone: {
      number: string;
    };
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    totalPrice: number;
    observations?: string;
  }>;
  total: {
    subTotal: number;
    deliveryFee: number;
    benefits: number;
    orderAmount: number;
  };
  payments: {
    methods: Array<{
      method: string;
      value: number;
    }>;
  };
  delivery?: {
    address: {
      streetName: string;
      streetNumber: string;
      neighborhood: string;
      city: string;
      state: string;
      postalCode: string;
      complement?: string;
      reference?: string;
    };
  };
}

interface IFoodOrderEvent {
  id: string;
  code: 'PLC' | 'CFM' | 'RTP' | 'DSP' | 'CON' | 'CAN';
  fullCode: string;
  orderId: string;
  createdAt: string;
}

/**
 * Obter token de acesso OAuth do iFood
 */
export async function getIFoodAccessToken(credentials: {
  clientId: string;
  clientSecret: string;
  grantType?: 'client_credentials' | 'authorization_code';
  authorizationCode?: string;
  refreshToken?: string;
}): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number } | null> {
  try {
    const body = new URLSearchParams();
    body.append('client_id', credentials.clientId);
    body.append('client_secret', credentials.clientSecret);
    body.append('grant_type', credentials.grantType || 'client_credentials');
    
    if (credentials.authorizationCode) {
      body.append('authorizationCode', credentials.authorizationCode);
    }
    
    if (credentials.refreshToken) {
      body.append('refresh_token', credentials.refreshToken);
    }

    const response = await fetch(IFOOD_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[iFood] Erro na autenticacao:', error);
      return null;
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error('[iFood] Erro ao obter token:', error);
    return null;
  }
}

/**
 * Buscar eventos de pedidos (polling)
 * O iFood usa polling, nao webhook
 */
export async function pollIFoodOrders(accessToken: string): Promise<IFoodOrderEvent[]> {
  try {
    const response = await fetch(`${IFOOD_API_URL}/order/v1.0/events:polling`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error('[iFood] Token expirado, necessario renovar');
      }
      return [];
    }

    const events = await response.json();
    return events || [];
  } catch (error) {
    console.error('[iFood] Erro ao buscar eventos:', error);
    return [];
  }
}

/**
 * Confirmar recebimento dos eventos (acknowledgment)
 */
export async function acknowledgeIFoodEvents(accessToken: string, eventIds: string[]): Promise<boolean> {
  try {
    const response = await fetch(`${IFOOD_API_URL}/order/v1.0/events/acknowledgment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventIds.map(id => ({ id }))),
    });

    return response.ok;
  } catch (error) {
    console.error('[iFood] Erro ao confirmar eventos:', error);
    return false;
  }
}

/**
 * Buscar detalhes de um pedido especifico
 */
export async function getIFoodOrderDetails(accessToken: string, orderId: string): Promise<IFoodOrder | null> {
  try {
    const response = await fetch(`${IFOOD_API_URL}/order/v1.0/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[iFood] Erro ao buscar pedido:', orderId);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[iFood] Erro ao buscar detalhes do pedido:', error);
    return null;
  }
}

/**
 * Aceitar/Confirmar um pedido
 */
export async function confirmIFoodOrder(accessToken: string, orderId: string): Promise<boolean> {
  try {
    const response = await fetch(`${IFOOD_API_URL}/order/v1.0/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('[iFood] Erro ao confirmar pedido:', error);
    return false;
  }
}

/**
 * Iniciar preparo do pedido
 */
export async function startPreparationIFood(accessToken: string, orderId: string): Promise<boolean> {
  try {
    const response = await fetch(`${IFOOD_API_URL}/order/v1.0/orders/${orderId}/startPreparation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('[iFood] Erro ao iniciar preparo:', error);
    return false;
  }
}

/**
 * Marcar pedido como pronto para retirada
 */
export async function readyToPickupIFood(accessToken: string, orderId: string): Promise<boolean> {
  try {
    const response = await fetch(`${IFOOD_API_URL}/order/v1.0/orders/${orderId}/readyToPickup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('[iFood] Erro ao marcar pronto:', error);
    return false;
  }
}

/**
 * Despachar pedido (entregador saiu)
 */
export async function dispatchIFoodOrder(accessToken: string, orderId: string): Promise<boolean> {
  try {
    const response = await fetch(`${IFOOD_API_URL}/order/v1.0/orders/${orderId}/dispatch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('[iFood] Erro ao despachar pedido:', error);
    return false;
  }
}

/**
 * Cancelar pedido
 */
export async function cancelIFoodOrder(
  accessToken: string, 
  orderId: string, 
  reason: string,
  cancellationCode: string
): Promise<boolean> {
  try {
    const response = await fetch(`${IFOOD_API_URL}/order/v1.0/orders/${orderId}/requestCancellation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason,
        cancellationCode,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[iFood] Erro ao cancelar pedido:', error);
    return false;
  }
}

/**
 * Converter pedido iFood para formato ZapFlow
 */
export function convertIFoodOrderToZapFlow(ifoodOrder: IFoodOrder, empresaId: number | string) {
  return {
    empresa_id: empresaId,
    origem: 'ifood',
    pedido_externo_id: ifoodOrder.id,
    cliente_nome: ifoodOrder.customer.name,
    cliente_telefone: ifoodOrder.customer.phone?.number || '',
    itens: ifoodOrder.items.map(item => ({
      nome: item.name,
      quantidade: item.quantity,
      preco: item.price,
      observacao: item.observations || '',
    })),
    valor_total: ifoodOrder.total.orderAmount,
    taxa_entrega: ifoodOrder.total.deliveryFee,
    tipo_pedido: ifoodOrder.type === 'DELIVERY' ? 'entrega' : ifoodOrder.type === 'TAKEOUT' ? 'retirada' : 'local',
    endereco: ifoodOrder.delivery ? {
      rua: ifoodOrder.delivery.address.streetName,
      numero: ifoodOrder.delivery.address.streetNumber,
      bairro: ifoodOrder.delivery.address.neighborhood,
      cidade: ifoodOrder.delivery.address.city,
      estado: ifoodOrder.delivery.address.state,
      cep: ifoodOrder.delivery.address.postalCode,
      complemento: ifoodOrder.delivery.address.complement || '',
      referencia: ifoodOrder.delivery.address.reference || '',
    } : null,
    pagamento: ifoodOrder.payments.methods.map(m => m.method).join(', '),
    status: 'pendente',
    criado_em: ifoodOrder.createdAt,
  };
}

/**
 * Codigos de evento do iFood
 */
export const IFOOD_EVENT_CODES = {
  PLC: 'Pedido colocado (novo pedido)',
  CFM: 'Pedido confirmado pelo restaurante',
  RTP: 'Pedido pronto para retirada',
  DSP: 'Pedido despachado',
  CON: 'Pedido concluido',
  CAN: 'Pedido cancelado',
};

/**
 * Motivos de cancelamento aceitos pelo iFood
 */
export const IFOOD_CANCELLATION_REASONS = [
  { code: '501', reason: 'Problemas de sistema' },
  { code: '502', reason: 'Pedido em duplicidade' },
  { code: '503', reason: 'Item indisponivel' },
  { code: '504', reason: 'Restaurante fechado' },
  { code: '505', reason: 'Cliente nao encontrado' },
  { code: '506', reason: 'Regiao fora da area de entrega' },
  { code: '507', reason: 'Cardapio desatualizado' },
  { code: '508', reason: 'Pedido fora do horario' },
  { code: '509', reason: 'Dificuldades internas' },
];
