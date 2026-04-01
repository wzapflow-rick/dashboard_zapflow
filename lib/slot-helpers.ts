/**
 * Helpers de cálculo para o Sistema de Slots.
 * Este arquivo é um utilitário puro (sem 'use server') e pode ser importado
 * tanto em componentes client-side quanto em server actions.
 */

import type { RegraPreco } from '@/app/actions/grupos-slots';

/**
 * Dada a regra de precificação do grupo e os preços dos itens selecionados,
 * retorna o preço a cobrar.
 */
export function calcularPrecoSlot(regra: RegraPreco, precos: number[]): number {
    if (precos.length === 0) return 0;
    switch (regra) {
        case 'mais_caro':
            return Math.max(...precos);
        case 'media':
            return precos.reduce((s, p) => s + p, 0) / precos.length;
        case 'soma':
            return precos.reduce((s, p) => s + p, 0);
        default:
            return Math.max(...precos);
    }
}

/**
 * Retorna o fator de proporção de cada slot ocupado.
 * Ex: 2 slots selecionados em grupo de 2 → cada um vale 0.5
 */
export function calcularFatorProporcao(qtdSlotsTotal: number, slotsOcupados: number): number {
    if (qtdSlotsTotal <= 0) return 1;
    return slotsOcupados / qtdSlotsTotal;
}
