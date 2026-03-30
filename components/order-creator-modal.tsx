'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Minus, ShoppingCart, User, Phone, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getProducts } from '@/app/actions/products';
import { nocoFetch } from '@/app/actions/insumos';
import { toast } from 'sonner';

interface Product {
    id: number;
    nome: string;
    preco: number;
    categoria_id?: any;
    imagem?: string;
}

interface CartItem extends Product {
    quantidade: number;
}

interface OrderCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function OrderCreatorModal({ isOpen, onClose, onSuccess }: OrderCreatorModalProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [clienteNome, setClienteNome] = useState('');
    const [clienteTelefone, setClienteTelefone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
        }
    }, [isOpen]);

    const fetchProducts = async () => {
        try {
            const data = await getProducts();
            setProducts(data);
        } catch (error) {
            toast.error('Erro ao buscar produtos');
        } finally {
            setIsLoadingProducts(false);
        }
    };

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantidade: item.quantidade + 1 } : item);
            }
            return [...prev, { ...product, quantidade: 1 }];
        });
    };

    const removeFromCart = (productId: number) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === productId);
            if (existing && existing.quantidade > 1) {
                return prev.map(item => item.id === productId ? { ...item, quantidade: item.quantidade - 1 } : item);
            }
            return prev.filter(item => item.id !== productId);
        });
    };

    const total = cart.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

    const handleSubmit = async () => {
        if (cart.length === 0) {
            toast.error('Adicione pelo menos um produto');
            return;
        }

        setIsSubmitting(true);
        try {
            // Payload seguindo o estilo solicitado pelo usuário
            const itensJson = cart.map(item => ({
                id: item.id,
                produto: item.nome,
                remocoes: [],
                adicionais: [],
                quantidade: item.quantidade,
                preco_unitario: item.preco
            }));

            const payload = {
                cliente_nome: clienteNome || 'Cliente Manual',
                telefone_cliente: clienteTelefone || '00000000000',
                itens: JSON.stringify(itensJson),
                valor_total: total,
                status: 'pendente',
                canal: 'Painel',
                data_pedido: new Date().toISOString()
            };

            const TABLE_PEDIDOS_ID = 'm9icndofh9z4jmi';
            await nocoFetch('/records', {
                method: 'POST',
                body: JSON.stringify(payload)
            }, TABLE_PEDIDOS_ID);

            toast.success('Pedido criado com sucesso!');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Erro ao criar pedido:', error);
            toast.error('Erro ao criar pedido manual');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredProducts = products.filter(p => p.nome.toLowerCase().includes(search.toLowerCase()));

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-5xl h-[85vh] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row"
                >
                    {/* Lista de Produtos */}
                    <div className="flex-1 flex flex-col min-w-0 border-r border-slate-100">
                        <header className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Novo Pedido</h2>
                                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">Criação Manual • PDV</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors md:hidden">
                                <X className="size-6 text-slate-400" />
                            </button>
                        </header>

                        <div className="p-4 bg-slate-50/50">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                                <input
                                    type="text"
                                    placeholder="Buscar produto pelo nome..."
                                    className="w-full h-12 pl-12 pr-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-primary/30 outline-none transition-all"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 custom-scrollbar">
                            {isLoadingProducts ? (
                                <div className="col-span-full flex items-center justify-center py-20">
                                    <Loader2 className="size-10 text-primary animate-spin" />
                                </div>
                            ) : (
                                filteredProducts.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        className="group p-4 bg-white border-2 border-slate-100 rounded-2xl text-left hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all active:scale-[0.98] flex flex-col justify-between gap-3"
                                    >
                                        <div>
                                            <h4 className="font-black text-slate-900 group-hover:text-primary transition-colors line-clamp-1">{p.nome}</h4>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Ref: {p.id}</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-auto">
                                            <span className="text-lg font-black text-slate-900">
                                                {Number(p.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                            <div className="size-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                                                <Plus className="size-5" />
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Carrinho e Cliente */}
                    <div className="w-full md:w-[380px] bg-slate-50 flex flex-col shrink-0">
                        <div className="p-6 bg-white border-b border-slate-100 hidden md:flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                    <ShoppingCart className="size-5" />
                                </div>
                                <h3 className="font-black text-slate-900">Carrinho</h3>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="size-6 text-slate-400" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {/* Itens do Carrinho */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Itens Selecionados</h4>
                                {cart.length === 0 ? (
                                    <div className="py-10 text-center space-y-2 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                                        <div className="size-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto">
                                            <ShoppingCart className="size-6" />
                                        </div>
                                        <p className="text-xs font-bold text-slate-400">Nenhum item adicionado</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-slate-900 line-clamp-1">{item.nome}</p>
                                                <p className="text-xs font-bold text-primary italic">
                                                    {(item.preco * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl shrink-0">
                                                <button onClick={() => removeFromCart(item.id)} className="size-7 flex items-center justify-center bg-white rounded-lg text-slate-400 hover:text-red-500 transition-colors shadow-sm">
                                                    <Minus className="size-4" />
                                                </button>
                                                <span className="w-6 text-center text-xs font-black text-slate-900">{item.quantidade}</span>
                                                <button onClick={() => addToCart(item)} className="size-7 flex items-center justify-center bg-white rounded-lg text-slate-400 hover:text-primary transition-colors shadow-sm">
                                                    <Plus className="size-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Informações do Cliente */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Dados do Cliente</h4>
                                <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="space-y-1.5 px-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                                            <input
                                                type="text"
                                                placeholder="Ex: João Silva"
                                                className="w-full h-11 pl-10 bg-slate-50 border-2 border-slate-50 rounded-xl text-sm font-bold outline-none focus:border-primary/20 transition-all"
                                                value={clienteNome}
                                                onChange={(e) => setClienteNome(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 px-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                                            <input
                                                type="text"
                                                placeholder="(79) 99999-9999"
                                                className="w-full h-11 pl-10 bg-slate-50 border-2 border-slate-50 rounded-xl text-sm font-bold outline-none focus:border-primary/20 transition-all"
                                                value={clienteTelefone}
                                                onChange={(e) => setClienteTelefone(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer de Resumo */}
                        <div className="p-6 bg-white border-t border-slate-100 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total do Pedido</span>
                                <span className="text-2xl font-black text-slate-900">
                                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || cart.length === 0}
                                className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <Loader2 className="size-6 animate-spin" /> : <Check className="size-6" />}
                                FINALIZAR E ENVIAR
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
