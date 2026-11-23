import { pg } from '@/lib/postgres';
import { calculateDeliveryFee, geocodeAddress } from './delivery';
import {
  COMPLEMENTOS_TABLE,
  CUPONS_TABLE,
  GRUPOS_COMPLEMENTOS_TABLE,
  LOYALTY_CONFIG_TABLE,
  LOYALTY_POINTS_TABLE,
  PRODUTOS_METADADOS_TABLE,
  PRODUTOS_TABLE,
  PRODUTO_GRUPOS_COMPLEMENTOS_TABLE,
  TAXAS_ENTREGA_TABLE,
} from '@/lib/tables';

type SelectedOption = { id: number; nome?: string; preco?: number; fator_proporcao?: number };
type SelectedGroup = { grupoId: number; grupoNome?: string; items: SelectedOption[] };
type InputItem = {
  id: number | string;
  nome?: string;
  preco?: number;
  quantidade: number;
  tamanho?: string;
  isComposite?: boolean;
  sabores?: Array<number | string>;
  complementos?: SelectedGroup[];
  observacao?: string;
};

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const isAvailable = (row: any) =>
  row?.disponivel !== false && row?.disponivel !== 0 &&
  row?.disponivel !== 'f' && row?.disponivel !== 'false';
const parseIds = (raw: unknown): number[] => {
  if (Array.isArray(raw)) return raw.map(Number).filter(Number.isFinite);
  if (typeof raw === 'string') return raw.split(',').map(Number).filter(Number.isFinite);
  return [];
};
const parseJson = (raw: unknown) => {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export async function calculatePublicOrderPricing(input: {
  empresaId: number;
  telefone: string;
  itens: InputItem[];
  cupomCodigo?: string;
  pontosUsados?: number;
}) {
  const empresaId = Number(input.empresaId);
  const [products, groups, options, links, metadata, coupons, loyaltyConfig, points] = await Promise.all([
    pg.listAll(PRODUTOS_TABLE, { where: { empresa_id: empresaId } }),
    pg.listAll(GRUPOS_COMPLEMENTOS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
    pg.listAll(COMPLEMENTOS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
    pg.listAll(PRODUTO_GRUPOS_COMPLEMENTOS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
    pg.raw<any>(
      `SELECT * FROM "${PRODUTOS_METADADOS_TABLE}" WHERE produto_id::text IN (SELECT id::text FROM "${PRODUTOS_TABLE}" WHERE empresa_id = $1)`,
      [empresaId]
    ).catch(() => []),
    pg.list(CUPONS_TABLE, { where: { empresa_id: empresaId, ativo: true }, limit: 1000 }).catch(() => ({ list: [] })),
    pg.findOne(LOYALTY_CONFIG_TABLE, { where: { empresa_id: empresaId } }).catch(() => null),
    Number(input.pontosUsados || 0) > 0
      ? pg.findOne(LOYALTY_POINTS_TABLE, {
          where: { cliente_telefone: String(input.telefone).replace(/\D/g, ''), empresa_id: empresaId },
        })
      : Promise.resolve(null),
  ]);

  const productById = new Map<number, any>((products || []).map((p: any) => [Number(p.id), p]));
  const groupById = new Map<number, any>((groups || []).map((g: any) => [Number(g.id), g]));
  const optionById = new Map<number, any>((options || []).map((o: any) => [Number(o.id), o]));
  const metadataByProduct = new Map<number, any>((metadata || []).map((m: any) => [Number(m.produto_id), m]));
  const linkedGroups = new Map<number, number[]>();
  for (const link of links || []) {
    const productId = Number(link.produto_id);
    const list = linkedGroups.get(productId) || [];
    list.push(Number(link.grupo_complemento_id));
    linkedGroups.set(productId, list);
  }

  const canonicalItems: any[] = [];
  let subtotal = 0;

  for (const item of input.itens || []) {
    const productId = Number(item.id);
    const product = productById.get(productId);
    if (!product || !isAvailable(product)) throw new Error('Um produto do pedido não está mais disponível.');
    const quantity = Number(item.quantidade);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) throw new Error('Quantidade inválida no pedido.');

    const isComposite = product.tipo === 'composto';
    const allowedGroupIds = new Set(
      linkedGroups.get(productId) || parseIds(isComposite ? (product.completamentos_ids ?? product.complementos_ids) : product.complementos_ids)
    );
    const metadata = metadataByProduct.get(productId);
    let sizes: any = parseJson(metadata?.tamanhos);
    if (!sizes && String(product.descricao || '').includes('[[SIZES:')) {
      const match = String(product.descricao).match(/\[\[SIZES:(.*)\]\]/);
      if (match?.[1]) sizes = parseJson(match[1]);
    }

    let price = asNumber(product.preco);
    let productName = String(product.nome || 'Produto');
    let flavorNames: string[] = [];

    if (isComposite) {
      const rawFlavors = Array.isArray(item.sabores) ? item.sabores.map(Number) : [];
      const compositeItems = Array.isArray(product.items) ? product.items : parseJson(product.items);
      const flavorRows = Array.isArray(compositeItems) ? compositeItems : [];
      if (rawFlavors.length) {
        const selected = rawFlavors.map(id => flavorRows.find((f: any) => Number(f.id) === id));
        if (selected.some((f: any) => !f || !isAvailable(f))) throw new Error('Um sabor selecionado não está mais disponível.');
        const minimum = Number(product.minimo || 1);
        const maximum = Number(product.maximo || 1);
        if (rawFlavors.length < minimum || rawFlavors.length > maximum || new Set(rawFlavors).size !== rawFlavors.length) {
          throw new Error('A seleção de sabores do pedido é inválida.');
        }
        price = Math.max(...selected.map((f: any) => asNumber(f.preco)));
        flavorNames = selected.map((f: any) => String(f.nome || ''));
      }
      productName = flavorNames.length
        ? `${productName} (${flavorNames.join(' / ')})`
        : productName;
      // Compatibilidade com carrinhos antigos: sem ids de sabor, cobrar o valor
      // base cadastrado no produto em vez de confiar no preço salvo no navegador.
    } else if (item.tamanho) {
      const selectedSize = Array.isArray(sizes)
        ? sizes.find((size: any) => String(size.nome) === String(item.tamanho))
        : null;
      if (!selectedSize) throw new Error(`O tamanho de "${productName}" mudou. Atualize o carrinho.`);
      price = asNumber(selectedSize.preco);
      productName += ` (${String(selectedSize.nome)})`;
    }

    const canonicalGroups: any[] = [];
    for (const selectedGroup of item.complementos || []) {
      const groupId = Number(selectedGroup.grupoId);
      if (!allowedGroupIds.has(groupId)) throw new Error('Um adicional não pertence mais a este produto.');
      const group = groupById.get(groupId);
      if (!group) throw new Error('Um grupo de adicionais não está mais disponível.');
      const selectedOptions = (selectedGroup.items || []).map(selected => {
        const option = optionById.get(Number(selected.id));
        if (!option || !isAvailable(option)) throw new Error('Um adicional selecionado não está mais disponível.');
        const optionGroupIds = option.grupo_id != null ? [Number(option.grupo_id)] : parseIds(option.grupos_ids);
        if (!optionGroupIds.includes(groupId)) throw new Error('Um adicional selecionado não pertence ao grupo.');
        return option;
      });
      if (new Set(selectedOptions.map((o: any) => Number(o.id))).size !== selectedOptions.length) {
        throw new Error('Há adicionais duplicados no pedido.');
      }
      if (!selectedOptions.length) continue;

      const prices = selectedOptions.map((o: any) => asNumber(o.preco));
      if (isComposite) {
        price += prices.reduce((sum: number, value: number) => sum + value, 0);
      } else if (group.tipo_calculo === 'fixo') {
        price += asNumber(group.preco_fixo);
      } else if (group.cobrar_mais_caro || group.tipo_calculo === 'maior_valor') {
        price = Math.max(price, ...prices);
      } else if (group.tipo_calculo === 'media') {
        price = Math.max(price, prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length);
      } else {
        price += prices.reduce((sum: number, p: number) => sum + p, 0);
      }

      canonicalGroups.push({
        grupoId: groupId,
        grupoNome: String(group.nome || ''),
        items: selectedOptions.map((option: any) => ({
          id: Number(option.id),
          nome: String(option.nome || ''),
          preco: asNumber(option.preco),
          fator_proporcao: asNumber(
            (selectedGroup.items || []).find(selected => Number(selected.id) === Number(option.id))?.fator_proporcao,
            1
          ),
        })),
      });
    }

    price = roundMoney(price);
    if (!Number.isFinite(price) || price < 0) throw new Error('Preço inválido no cardápio.');
    if ((!isComposite || (Array.isArray(item.sabores) && item.sabores.length > 0)) &&
        Math.abs(asNumber(item.preco) - price) > 0.01) {
      throw new Error(`O preço de "${productName}" mudou. Atualize o carrinho para continuar.`);
    }
    subtotal += price * quantity;
    canonicalItems.push({
      id: productId,
      nome: productName,
      preco: price,
      quantidade: quantity,
      tamanho: item.tamanho || '',
      isComposite,
      sabores: flavorNames,
      complementos: canonicalGroups,
      observacao: String(item.observacao || ''),
    });
  }
  subtotal = roundMoney(subtotal);

  let couponDiscount = 0;
  let couponId: number | string | undefined;
  let couponCode: string | undefined;
  if (input.cupomCodigo?.trim()) {
    const coupon = (coupons.list || []).find((c: any) =>
      String(c.codigo || '').toUpperCase() === input.cupomCodigo!.trim().toUpperCase()
    ) as any;
    if (!coupon) throw new Error('O cupom não está mais válido. Confira o código e tente novamente.');
    const now = new Date();
    const start = coupon.data_inicio ? new Date(`${String(coupon.data_inicio).slice(0, 10)}T00:00:00`) : null;
    const end = coupon.data_fim ? new Date(`${String(coupon.data_fim).slice(0, 10)}T23:59:59`) : null;
    if (coupon.limite_uso && Number(coupon.usos_atuais || 0) >= Number(coupon.limite_uso)) throw new Error('O limite de uso deste cupom foi atingido.');
    if (start && now < start) throw new Error('Este cupom ainda não está válido.');
    if (end && now > end) throw new Error('Este cupom expirou.');
    if (Number(coupon.valor_minimo_pedido || 0) > subtotal) throw new Error('O pedido não atinge o valor mínimo do cupom.');
    const rawDiscount = coupon.tipo === 'percentual'
      ? subtotal * (asNumber(coupon.valor) / 100)
      : asNumber(coupon.valor);
    couponDiscount = roundMoney(Math.max(0, Math.min(rawDiscount, subtotal - 1)));
    couponId = coupon.id;
    couponCode = String(coupon.codigo);
  }

  const requestedPoints = Math.floor(Number(input.pontosUsados || 0));
  let pointsUsed = 0;
  let pointsDiscount = 0;
  if (requestedPoints > 0) {
    const config = loyaltyConfig as any;
    const accumulated = asNumber((points as any)?.pontos_acumulados);
    const spent = asNumber((points as any)?.pontos_gastos);
    const available = Math.max(0, accumulated - spent);
    const blockSize = Math.max(1, Math.floor(asNumber(config?.pontos_para_desconto, 100)));
    const blockDiscount = asNumber(config?.desconto_valor);
    if (config?.ativo !== true || !points || requestedPoints > available || requestedPoints % blockSize !== 0 || blockDiscount <= 0) {
      throw new Error('Os pontos não estão mais disponíveis. Atualize o carrinho.');
    }
    const desiredDiscount = (requestedPoints / blockSize) * blockDiscount;
    const remainingDiscount = Math.max(0, subtotal - couponDiscount);
    const redeemableBlocks = Math.min(requestedPoints / blockSize, Math.floor(remainingDiscount / blockDiscount));
    pointsUsed = redeemableBlocks * blockSize;
    pointsDiscount = roundMoney(redeemableBlocks * blockDiscount);
    if (pointsUsed <= 0 || roundMoney(desiredDiscount) !== pointsDiscount) {
      throw new Error('O desconto por pontos mudou. Atualize o carrinho.');
    }
  }

  return {
    itens: canonicalItems,
    subtotal,
    couponDiscount,
    couponId,
    couponCode,
    pointsUsed,
    pointsDiscount,
    pointsEarned: loyaltyConfig && (loyaltyConfig as any).ativo === true
      ? Math.max(0, Math.floor(subtotal * asNumber((loyaltyConfig as any).pontos_por_real, 1)))
      : 0,
    discount: roundMoney(couponDiscount + pointsDiscount),
  };
}

export async function calculatePublicDeliveryFee(input: {
  empresaId: number;
  empresa: any;
  tipoEntrega: 'delivery' | 'retirada';
  endereco?: string;
  bairro?: string;
}): Promise<{ taxa: number; fallback: boolean }> {
  if (input.tipoEntrega !== 'delivery') return { taxa: 0, fallback: false };

  const fixedFee = Math.max(0, asNumber(input.empresa?.taxa_entrega_fixa));
  const autoRadius = input.empresa?.raio_entrega_automatico === true ||
    input.empresa?.raio_entrega_automatico === 't' ||
    input.empresa?.raio_entrega_automatico === 1;

  if (!autoRadius) {
    try {
      const rates = await pg.list(TAXAS_ENTREGA_TABLE, {
        where: { empresa_id: Number(input.empresaId) },
        limit: 1000,
      });
      const availableRates = rates.list || [];
      if (availableRates.length > 0) {
        const normalizedNeighborhood = String(input.bairro || '').trim().toLowerCase();
        const match = availableRates.find((rate: any) =>
          String(rate.bairro || '').trim().toLowerCase() === normalizedNeighborhood
        ) || availableRates.find((rate: any) => {
          const rateNeighborhood = String(rate.bairro || '').trim().toLowerCase();
          return rateNeighborhood && normalizedNeighborhood &&
            (rateNeighborhood.includes(normalizedNeighborhood) || normalizedNeighborhood.includes(rateNeighborhood));
        });
        if (!match) throw new Error('Este bairro não está na área de entrega da loja.');
        return { taxa: Math.max(0, asNumber(match.taxa)), fallback: false };
      }
    } catch (error: any) {
      if (error?.message === 'Este bairro não está na área de entrega da loja.') throw error;
      console.error('[PublicOrder] Não foi possível ler as taxas por bairro; usando taxa fixa:', error);
    }
    return { taxa: fixedFee, fallback: false };
  }

  const fullAddress = [input.endereco, input.bairro].map(value => String(value || '').trim()).filter(Boolean).join(', ');
  if (!fullAddress) return { taxa: fixedFee, fallback: true };

  const geocode = await geocodeAddress(
    fullAddress,
    typeof input.empresa?.cidade === 'string' ? input.empresa.cidade : undefined,
    typeof input.empresa?.estado === 'string' ? input.empresa.estado : undefined,
  );
  if (!geocode) throw new Error('Não foi possível localizar o endereço. Confira os dados e tente novamente.');
  if ('error' in geocode) {
    // Billing/quota/provider failures must not block checkout; use the company's
    // configured fixed fee until the map service is healthy again.
    console.warn('[PublicOrder] Geocodificação indisponível; usando taxa fixa da loja.');
    return { taxa: fixedFee, fallback: true };
  }

  const calculated = await calculateDeliveryFee(geocode, Number(input.empresaId));
  if (calculated.success && calculated.taxa_entrega !== undefined) {
    return { taxa: Math.max(0, asNumber(calculated.taxa_entrega)), fallback: false };
  }

  const errorMessage = String(calculated.error || '');
  if (/fora da área|máx:|localização da loja não configurada|coordenadas inválidas|distância inválida/i.test(errorMessage)) {
    throw new Error(errorMessage || 'Endereço fora da área de entrega.');
  }

  console.warn('[PublicOrder] Distância indisponível; usando taxa fixa da loja.');
  return { taxa: fixedFee, fallback: true };
}
