'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';
import { getProducts, upsertProduct, upsertCategory } from './products';
import { upsertCustomer } from './customers';
import { upsertInsumo } from './insumos';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const ORDERS_TABLE_ID = 'm2ic8zof3feve3l';

async function nocoFetch(tableId: string, endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${tableId}${endpoint}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'xc-token': NOCODB_TOKEN,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`NocoDB API Error: ${res.status} ${text}`);
    }

    return res;
}

const FIRST_NAMES = ['João', 'Maria', 'Pedro', 'Ana', 'Lucas', 'Julia', 'Carlos', 'Beatriz', 'Marcos', 'Fernanda'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Almeida', 'Pereira', 'Carvalho', 'Gomes'];
const STREETS = ['Av. Paulista', 'Rua Augusta', 'Rua Oscar Freire', 'Av. Brasil', 'Rua das Flores', 'Av. Getúlio Vargas'];

export async function generateMockOrder() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const products = await getProducts();
        if (products.length === 0) throw new Error('Adicione pelo menos um produto ao cardápio antes de testar.');

        // 1. Gerar dados do cliente
        const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        const nome = `${firstName} ${lastName}`;
        const telefone = `55${Math.floor(10 + Math.random() * 90)}9${Math.floor(1000 + Math.random() * 9000)}${Math.floor(1000 + Math.random() * 9000)}`;

        // 2. Garantir que o cliente exista na base
        await upsertCustomer({ nome, telefone });

        // 3. Escolher 1 a 3 produtos aleatórios
        const numItems = Math.floor(Math.random() * 3) + 1;
        const selectedProducts = [];
        let total = 0;

        for (let i = 0; i < numItems; i++) {
            const product = products[Math.floor(Math.random() * products.length)];
            const quantity = Math.floor(Math.random() * 2) + 1;
            selectedProducts.push({
                produto: product.nome,
                preco_unitario: Number(product.preco),
                remocoes: [],
                adicionais: [],
                quantidade: quantity,
                id: Number(product.id)
            });
            total += Number(product.preco) * quantity;
        }

        const isDelivery = Math.random() > 0.3;
        if (isDelivery) {
            selectedProducts.push({
                produto: 'Taxa de Entrega',
                preco_unitario: 5.00,
                remocoes: [],
                adicionais: [],
                quantidade: 1
            });
            total += 5.00; // Mock delivery tax
        }

        // 4. Criar o pedido
        const orderPayload = {
            empresa_id: user.empresaId,
            empresas: user.empresaId,
            telefone_cliente: telefone,
            itens: JSON.stringify(selectedProducts),
            valor_total: Number(total.toFixed(2)),
            status: 'pendente',
            forma_pagamento: ['Pix', 'Cartão', 'Dinheiro'][Math.floor(Math.random() * 3)],
            tipo_entrega: isDelivery ? 'delivery' : 'retirada',
            bairro_entrega: isDelivery ? STREETS[Math.floor(Math.random() * STREETS.length)] : null,
            endereco: isDelivery ? `${STREETS[Math.floor(Math.random() * STREETS.length)]}, ${Math.floor(Math.random() * 1000)}` : 'Retirada no Balcão',
            origem: 'Módulo de Testes'
        };

        const res = await nocoFetch(ORDERS_TABLE_ID, '/records', {
            method: 'POST',
            body: JSON.stringify(orderPayload)
        });

        revalidatePath('/dashboard/expedition');
        revalidatePath('/dashboard/customers');

        return await res.json();
    } catch (error: any) {
        console.error('Mock Generation Error:', error);
        throw new Error(error.message || 'Falha ao gerar pedido de teste');
    }
}

export async function setupPizzariaFicticia() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // 1. Criar Insumos
        const insumos = [
            { nome: 'Queijo Mussarela', quantidade_atual: 10, unidade_medida: 'kg', estoque_minimo: 2, custo_por_unidade: 45 },
            { nome: 'Molho de Tomate', quantidade_atual: 5, unidade_medida: 'L', estoque_minimo: 1, custo_por_unidade: 8 },
            { nome: 'Calabresa Fatiada', quantidade_atual: 4, unidade_medida: 'kg', estoque_minimo: 1, custo_por_unidade: 35 }
        ];

        const savedInsumos = [];
        for (const ins of insumos) {
            const result = await upsertInsumo(ins);
            savedInsumos.push(result);
        }

        // 2. Criar Categoria
        const categoria = await upsertCategory({ nome: 'Pizzas (Teste)' });

        // 3. Criar Produto com Receita
        const pizza = {
            nome: 'Pizza de Calabresa (Teste)',
            preco: 59.90,
            categoria_id: categoria.id,
            disponivel: true,
            descricao: 'Pizza artesanal com molho, mussarela e calabresa selecionada.'
        };

        const receita = [
            { insumo_id: savedInsumos[0].id, quantidade_necessaria: 0.200 }, // 200g mussarela
            { insumo_id: savedInsumos[1].id, quantidade_necessaria: 0.100 }, // 100ml molho
            { insumo_id: savedInsumos[2].id, quantidade_necessaria: 0.150 }  // 150g calabresa
        ];

        await upsertProduct(pizza, receita);

        revalidatePath('/dashboard/insumos');
        revalidatePath('/dashboard/menu');
        revalidatePath('/dashboard/categories');

        return { success: true };
    } catch (error: any) {
        console.error('Setup Error:', error);
        throw new Error(error.message || 'Falha ao configurar pizzaria de teste');
    }
}
