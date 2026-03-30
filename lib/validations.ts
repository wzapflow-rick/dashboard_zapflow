import { z } from 'zod';

// Auth
export const LoginSchema = z.object({
    email: z.string().email('E-mail inválido').min(3, 'E-mail deve ter pelo menos 3 caracteres'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

// Products
export const ProductSchema = z.object({
    id: z.number().optional().or(z.string().optional()),
    nome: z.string().min(2, 'Nome muito curto'),
    preco: z.coerce.number().positive('Preço deve ser positivo'),
    categoria_id: z.coerce.number().int().positive('Categoria é obrigatória'),
    descricao: z.string().optional(),
    disponivel: z.boolean().default(true),
    imagem_url: z.string().url().optional().or(z.literal('')),
});

// Categories
export const CategorySchema = z.object({
    id: z.number().optional().or(z.string().optional()),
    nome: z.string().min(2, 'Nome da categoria muito curto'),
    ordem: z.coerce.number().int().default(0),
});

// Orders (Admin update)
export const OrderStatusSchema = z.object({
    orderId: z.coerce.number().int(),
    status: z.enum(['pendente', 'preparando', 'saiu_entrega', 'concluido', 'cancelado']),
});

// Customers
export const CustomerSchema = z.object({
    nome: z.string().min(2, 'Nome obrigatório'),
    telefone: z.string().min(10, 'Telefone inválido'),
    endereco: z.string().optional(),
    bairro: z.string().optional(),
});
