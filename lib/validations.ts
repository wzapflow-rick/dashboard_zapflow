import { z } from 'zod';

// Sanitization helper - remove HTML tags and dangerous characters
export function sanitizeString(str: string): string {
    return str.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
}

// Auth
export const LoginSchema = z.object({
    email: z.string().email('E-mail inválido').min(3, 'E-mail deve ter pelo menos 3 caracteres'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

// Products
export const ProductSchema = z.object({
    id: z.number().optional().or(z.string().optional()),
    nome: z.string().min(2, 'Nome muito curto').transform(sanitizeString),
    preco: z.coerce.number().positive('Preço deve ser positivo'),
    categoria_id: z.coerce.number().int().positive('Categoria é obrigatória'),
    descricao: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    disponivel: z.boolean().default(true),
    imagem_url: z.string().url().optional().or(z.literal('')),
});

// Categories
export const CategorySchema = z.object({
    id: z.number().optional().or(z.string().optional()),
    nome: z.string().min(2, 'Nome da categoria muito curto').transform(sanitizeString),
    ordem: z.coerce.number().int().default(0),
});

// Company Update
export const CompanyUpdateSchema = z.object({
    nome_fantasia: z.string().min(2).optional().transform(val => val ? sanitizeString(val) : val),
    email: z.string().email().optional(),
    chave_pix: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    nome_recebedor_pix: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    nome_admin: z.string().min(2).optional().transform(val => val ? sanitizeString(val) : val),
    telefone_loja: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    cnpj: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    endereco: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    cidade: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    estado: z.string().length(2).optional().transform(val => val ? sanitizeString(val) : val),
    instancia_evolution: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    nincho: z.string().optional(),
    raio_entrega_automatico: z.boolean().optional(),
    valor_por_km: z.coerce.number().min(0).optional(),
    lat_loja: z.coerce.number().optional(),
    lng_loja: z.coerce.number().optional(),
    cobra_embalagem: z.boolean().optional(),
    valor_embalagem: z.coerce.number().min(0).optional(),
    controle_estoque: z.boolean().optional(),
});

// Orders (Admin update)
export const OrderStatusSchema = z.object({
    orderId: z.coerce.number().int(),
    status: z.enum(['pendente', 'preparando', 'saiu_entrega', 'concluido', 'cancelado']),
});

// Customers
export const CustomerSchema = z.object({
    nome: z.string().min(2, 'Nome obrigatório').transform(sanitizeString),
    telefone: z.string().min(10, 'Telefone inválido').transform(sanitizeString),
    endereco: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    bairro: z.string().optional().transform(val => val ? sanitizeString(val) : val),
});

// Insumos
export const InsumoSchema = z.object({
    id: z.number().optional().or(z.string().optional()),
    nome: z.string().min(2, 'Nome muito curto').transform(sanitizeString),
    quantidade_atual: z.coerce.number().min(0, 'Quantidade não pode ser negativa'),
    unidade_medida: z.string().min(1, 'Unidade é obrigatória'),
    estoque_minimo: z.coerce.number().min(0, 'Estoque mínimo não pode ser negativo'),
    custo_por_unidade: z.coerce.number().min(0, 'Custo não pode ser negativo'),
});

// Grupos de Complementos
export const GrupoComplementoSchema = z.object({
    id: z.number().optional().or(z.string().optional()),
    nome: z.string().min(2, 'Nome muito curto').transform(sanitizeString),
    descricao: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    tipo: z.enum(['unico', 'multipla']),
    max_opcoes: z.coerce.number().int().min(1, 'Mínimo 1 opção'),
    preco: z.coerce.number().min(0).optional(),
    produto_composto: z.boolean().default(false),
    obrigatorio: z.boolean().default(false),
});

// Itens de Complemento (sabores, etc)
export const ComplementoItemSchema = z.object({
    id: z.number().optional().or(z.string().optional()),
    nome: z.string().min(2, 'Nome muito curto').transform(sanitizeString),
    grupo_id: z.coerce.number().int().positive('Grupo é obrigatório'),
    preco: z.coerce.number().min(0, 'Preço não pode ser negativo'),
    disponivel: z.boolean().default(true),
});

// Grupos de Slots (opcionais)
export const GrupoSlotSchema = z.object({
    id: z.number().optional().or(z.string().optional()),
    nome: z.string().min(2, 'Nome muito curto').transform(sanitizeString),
    descricao: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    tipo: z.enum(['fracionado', 'adicional']),
    qtd_slots: z.coerce.number().int().min(1, 'Mínimo 1 slot'),
    regra_preco: z.enum(['mais_caro', 'media', 'soma']),
    min_slots: z.coerce.number().int().min(0),
    max_slots: z.coerce.number().int().min(1),
});

// Itens Base (sabores para slots)
export const ItemBaseSchema = z.object({
    id: z.number().optional().or(z.string().optional()),
    nome: z.string().min(2, 'Nome muito curto').transform(sanitizeString),
    preco_sugerido: z.coerce.number().min(0, 'Preço não pode ser negativo'),
    preco_custo: z.coerce.number().min(0, 'Custo não pode ser negativo'),
});

// Horários de Funcionamento
export const HorarioSchema = z.object({
    dia_semana: z.coerce.number().int().min(0).max(6),
    hora_abertura: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
    hora_fechamento: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
    fechado_o_dia_todo: z.boolean().default(false),
});

// Customer Update (com telefone obrigatório para upsert)
export const CustomerUpsertSchema = z.object({
    telefone: z.string().min(10, 'Telefone inválido').transform(sanitizeString),
    nome: z.string().min(2, 'Nome obrigatório').transform(sanitizeString),
    bairro_entrega: z.string().optional().transform(val => val ? sanitizeString(val) : val),
    endereco_completo: z.string().optional().transform(val => val ? sanitizeString(val) : val),
});
