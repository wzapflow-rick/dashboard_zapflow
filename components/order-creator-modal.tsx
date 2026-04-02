'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Plus, Minus, ShoppingCart, User, Phone, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getProducts } from '@/app/actions/products';
import { nocoFetch } from '@/app/actions/insumos';
import { getCompositeProducts, type CompositeProduct, type CompositeItem } from '@/app/actions/grupos-slots';
import { createManualOrder } from '@/app/actions/orders';
import { toast } from 'sonner';
import { checkCustomerByPhone } from '@/app/actions/public-orders';
import RegisterCustomerModal from './expedition/register-customer-modal';
import { getMe } from '@/app/actions/auth';

interface Product {
    id: number;
    nome: string;
    preco: number;
    categoria_id?: any;
    imagem?: string;
}

interface CartItem extends Product {
    quantidade: number;
    isComposite?: boolean;
    compositeItems?: CompositeItem[];
    compositeId?: string;
}

interface OrderCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function OrderCreatorModal({ isOpen, onClose, onSuccess }: OrderCreatorModalProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [compositeProducts, setCompositeProducts] = useState<CompositeProduct[]>([]);
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [clienteNome, setClienteNome] = useState('');
    const [clienteTelefone, setClienteTelefone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [isCompositeModalOpen, setIsCompositeModalOpen] = useState(false);
    const [selectedComposite, setSelectedComposite] = useState<CompositeProduct | null>(null);
    const [selectedItems, setSelectedItems] = useState<CompositeItem[]>([]);
    
    // Customer verification states
    const [isExistingCustomer, setIsExistingCustomer] = useState(false);
    const [checkingCustomer, setCheckingCustomer] = useState(false);
    const [phoneChecked, setPhoneChecked] = useState(false);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [customerToRegister, setCustomerToRegister] = useState<any>(null);
    const [empresaId, setEmpresaId] = useState<number | null>(null);
    const lastCheckedPhoneRef = useRef<string>('');
    const hasOpenedRegisterModalRef = useRef<boolean>(false);

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            fetchUser();
        }
    }, [isOpen]);

    const fetchUser = async () => {
        try {
            const user = await getMe();
            if (user?.empresaId) {
                setEmpresaId(user.empresaId);
            }
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const [productsData, compositeData] = await Promise.all([
                getProducts(),
                getCompositeProducts(),
            ]);
            setProducts(productsData);
            setCompositeProducts(compositeData);
        } catch (error) {
            toast.error('Erro ao buscar produtos');
        } finally {
            setIsLoadingProducts(false);
        }
    };

    const checkCustomerExists = useCallback(async (telefone: string) => {
        const cleanPhone = telefone.replace(/\D/g, '');
        if (cleanPhone.length < 10 || !empresaId) {
            setPhoneChecked(false);
            setIsExistingCustomer(false);
            hasOpenedRegisterModalRef.current = false;
            return;
        }
        
        // Evitar verificar o mesmo telefone novamente se já verificamos e o cliente não existe
        // mas permitir nova verificação se o telefone mudou
        if (cleanPhone === lastCheckedPhoneRef.current && phoneChecked) {
            return;
        }
        
        setCheckingCustomer(true);
        try {
            const customer = await checkCustomerByPhone(empresaId, cleanPhone);
            
            if (customer) {
                setIsExistingCustomer(true);
                setClienteNome(customer.nome || '');
                hasOpenedRegisterModalRef.current = false;
                // Preencher outros dados se disponíveis
                // Não vamos preencher endereço aqui, pois não temos campos no modal
            } else {
                setIsExistingCustomer(false);
                // Se o cliente não existe, abrir modal de registro apenas se ainda não abrimos para este telefone
                if (!hasOpenedRegisterModalRef.current) {
                    setCustomerToRegister({
                        telefone_cliente: cleanPhone,
                        bairro_entrega: '',
                    });
                    setShowRegisterModal(true);
                    hasOpenedRegisterModalRef.current = true;
                }
            }
            setPhoneChecked(true);
            lastCheckedPhoneRef.current = cleanPhone;
        } catch (error) {
            console.error('Erro ao verificar cliente:', error);
            setIsExistingCustomer(false);
            setPhoneChecked(true);
        } finally {
            setCheckingCustomer(false);
        }
    }, [empresaId, phoneChecked]);

    // Debounce para verificar cliente quando telefone muda
    useEffect(() => {
        const timer = setTimeout(() => {
            if (clienteTelefone && empresaId) {
                checkCustomerExists(clienteTelefone);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [clienteTelefone, empresaId, checkCustomerExists]);

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
            const itensJson = cart.map(item => {
                const baseItem = {
                    id: item.id,
                    produto: item.nome,
                    remocoes: [],
                    adicionais: [],
                    quantidade: item.quantidade,
                    preco_unitario: item.preco
                };

                // Se for produto composto, adicionar informações dos itens selecionados
                if (item.isComposite && item.compositeItems) {
                    return {
                        ...baseItem,
                        complements: item.compositeItems.map(comp => ({
                            id: comp.id,
                            grupo_id: comp.grupo_id,
                            nome: comp.nome,
                            tipo_calculo: selectedComposite?.tipo_calculo,
                            cobrar_mais_caro: selectedComposite?.cobrar_mais_caro,
                            fator_proporcao: comp.fator_proporcao,
                        })),
                        compositeId: item.compositeId,
                        isComposite: true,
                    };
                }

                return baseItem;
            });

            const payload = {
                cliente_nome: clienteNome || 'Cliente Manual',
                telefone_cliente: clienteTelefone || '00000000000',
                itens: JSON.stringify(itensJson),
                valor_total: total,
                status: 'pendente',
                canal: 'Painel',
                data_pedido: new Date().toISOString()
            };

            const TABLE_PEDIDOS_ID = 'm2ic8zof3feve3l';
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
    const filteredComposite = compositeProducts.filter(p => p.nome.toLowerCase().includes(search.toLowerCase()));

    const openCompositeModal = (composite: CompositeProduct) => {
        setSelectedComposite(composite);
        setSelectedItems([]);
        setIsCompositeModalOpen(true);
    };

    const toggleItemSelection = (item: CompositeItem) => {
        setSelectedItems(prev => {
            const isSelected = prev.some(i => i.id === item.id);
            if (isSelected) {
                return prev.filter(i => i.id !== item.id);
            } else {
                // Verificar limite máximo
                if (selectedComposite && prev.length >= selectedComposite.maximo) {
                    toast.warning(`Máximo de ${selectedComposite.maximo} itens permitidos.`);
                    return prev;
                }
                return [...prev, item];
            }
        });
    };

    const handleAddCompositeToCart = () => {
        if (!selectedComposite || selectedItems.length === 0) return;

        // Calcular preço baseado na regra
        let price = 0;
        const prices = selectedItems.map(i => i.preco);
        if (selectedComposite.cobrar_mais_caro || selectedComposite.tipo_calculo === 'maior_valor') {
            price = Math.max(...prices);
        } else if (selectedComposite.tipo_calculo === 'media') {
            price = prices.reduce((a, b) => a + b, 0) / prices.length;
        } else {
            // soma
            price = selectedItems.reduce((total, i) => total + (i.preco * i.fator_proporcao), 0);
        }

        const cartItem: CartItem = {
            id: selectedComposite._grupoId, // Usar ID do grupo
            nome: selectedComposite.nome,
            preco: price,
            quantidade: 1,
            // Campos opcionais para produtos compostos
            isComposite: true,
            compositeItems: selectedItems,
            compositeId: selectedComposite.id,
        };

        setCart(prev => {
            const existing = prev.find(item => item.id === cartItem.id && item.isComposite);
            if (existing) {
                return prev.map(item => item.id === cartItem.id ? { ...item, quantidade: item.quantidade + 1 } : item);
            }
            return [...prev, cartItem];
        });

        setIsCompositeModalOpen(false);
        setSelectedComposite(null);
        setSelectedItems([]);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div key="main-modal" className="fixed inset-0 z-[150] flex items-center justify-center p-4">
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
                    className="relative w-full max-w-5xl h-[85vh] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row dark:bg-slate-800"
                >
                    {/* Lista de Produtos */}
                    <div className="flex-1 flex flex-col min-w-0 border-r border-slate-100 dark:border-slate-700">
                        <header className="p-6 border-b border-slate-100 flex items-center justify-between dark:border-slate-700">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight dark:text-white">Novo Pedido</h2>
                                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider dark:text-slate-400">Criação Manual • PDV</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors md:hidden dark:hover:bg-slate-700">
                                <X className="size-6 text-slate-400" />
                            </button>
                        </header>

                        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                                <input
                                    type="text"
                                    placeholder="Buscar produto pelo nome..."
                                    className="w-full h-12 pl-12 pr-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-primary/30 outline-none transition-all dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-400"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                            {isLoadingProducts ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="size-10 text-primary animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {/* Produtos Normais */}
                                    {filteredProducts.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1 dark:text-slate-500">Produtos</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {filteredProducts.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => addToCart(p)}
                                                        className="group p-4 bg-white border-2 border-slate-100 rounded-2xl text-left hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all active:scale-[0.98] flex flex-col justify-between gap-3 dark:bg-slate-700 dark:border-slate-600"
                                                    >
                                                        <div>
                                                            <h4 className="font-black text-slate-900 group-hover:text-primary transition-colors line-clamp-1 dark:text-white dark:group-hover:text-primary">{p.nome}</h4>
                                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 dark:text-slate-500">Ref: {p.id}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-auto">
                                                            <span className="text-lg font-black text-slate-900 dark:text-white">
                                                                {Number(p.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                            </span>
                                                            <div className="size-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all dark:bg-slate-600 dark:text-slate-300">
                                                                <Plus className="size-5" />
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Produtos Compostos (Grupos de Slots) */}
                                    {filteredComposite.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1 dark:text-slate-500">Produtos Compostos</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {filteredComposite.map(comp => (
                                                    <button
                                                        key={comp.id}
                                                        onClick={() => openCompositeModal(comp)}
                                                        className="group p-4 bg-amber-50 border-2 border-amber-100 rounded-2xl text-left hover:border-amber-300 hover:shadow-xl hover:shadow-amber-100 transition-all active:scale-[0.98] flex flex-col justify-between gap-3 dark:bg-amber-900/30 dark:border-amber-700"
                                                    >
                                                        <div>
                                                            <h4 className="font-black text-amber-900 group-hover:text-amber-700 transition-colors line-clamp-1 dark:text-amber-400">{comp.nome}</h4>
                                                            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest mt-1 dark:text-amber-500">Montar</span>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-auto">
                                                            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                                                                {comp.minimo === comp.maximo 
                                                                    ? `Escolha ${comp.maximo} item${comp.maximo > 1 ? 'ns' : ''}`
                                                                    : `De ${comp.minimo} a ${comp.maximo} itens`}
                                                            </span>
                                                            <div className="size-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all dark:bg-amber-800 dark:text-amber-400">
                                                                <Plus className="size-5" />
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {filteredProducts.length === 0 && filteredComposite.length === 0 && (
                                        <div className="col-span-full flex items-center justify-center py-20">
                                            <p className="text-slate-400 dark:text-slate-500">Nenhum produto encontrado</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Carrinho e Cliente */}
                    <div className="w-full md:w-[380px] bg-slate-50 flex flex-col shrink-0 dark:bg-slate-900">
                        <div className="p-6 bg-white border-b border-slate-100 hidden md:flex items-center justify-between dark:bg-slate-800 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                    <ShoppingCart className="size-5" />
                                </div>
                                <h3 className="font-black text-slate-900 dark:text-white">Carrinho</h3>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors dark:hover:bg-slate-700">
                                <X className="size-6 text-slate-400" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {/* Itens do Carrinho */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 dark:text-slate-500">Itens Selecionados</h4>
                                {cart.length === 0 ? (
                                    <div className="py-10 text-center space-y-2 border-2 border-dashed border-slate-200 rounded-2xl bg-white dark:bg-slate-800 dark:border-slate-600">
                                        <div className="size-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto dark:bg-slate-700">
                                            <ShoppingCart className="size-6" />
                                        </div>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Nenhum item adicionado</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between gap-3 dark:bg-slate-800 dark:border-slate-700">
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-slate-900 line-clamp-1 dark:text-white">{item.nome}</p>
                                                <p className="text-xs font-bold text-primary italic">
                                                    {(item.preco * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl shrink-0 dark:bg-slate-700">
                                                <button onClick={() => removeFromCart(item.id)} className="size-7 flex items-center justify-center bg-white rounded-lg text-slate-400 hover:text-red-500 transition-colors shadow-sm dark:bg-slate-600 dark:text-slate-300">
                                                    <Minus className="size-4" />
                                                </button>
                                                <span className="w-6 text-center text-xs font-black text-slate-900 dark:text-white">{item.quantidade}</span>
                                                <button onClick={() => addToCart(item)} className="size-7 flex items-center justify-center bg-white rounded-lg text-slate-400 hover:text-primary transition-colors shadow-sm dark:bg-slate-600 dark:text-slate-300">
                                                    <Plus className="size-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Informações do Cliente */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 dark:text-slate-500">Dados do Cliente</h4>
                                <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                                    <div className="space-y-1.5 px-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 dark:text-slate-500">Nome Completo</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300 dark:text-slate-500" />
                                            <input
                                                type="text"
                                                placeholder="Ex: João Silva"
                                                className="w-full h-11 pl-10 bg-slate-50 border-2 border-slate-50 rounded-xl text-sm font-bold outline-none focus:border-primary/20 transition-all dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-400"
                                                value={clienteNome}
                                                onChange={(e) => setClienteNome(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 px-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 dark:text-slate-500">WhatsApp</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300 dark:text-slate-500" />
                                            <input
                                                type="text"
                                                placeholder="(79) 99999-9999"
                                                className="w-full h-11 pl-10 bg-slate-50 border-2 border-slate-50 rounded-xl text-sm font-bold outline-none focus:border-primary/20 transition-all dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-400"
                                                value={clienteTelefone}
                                                onChange={(e) => setClienteTelefone(e.target.value)}
                                            />
                                            {checkingCustomer && (
                                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-primary animate-spin" />
                                            )}
                                            {!checkingCustomer && phoneChecked && isExistingCustomer && (
                                                <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-green-500" />
                                            )}
                                            {!checkingCustomer && phoneChecked && !isExistingCustomer && clienteTelefone.length >= 10 && (
                                                <User className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-amber-500" />
                                            )}
                                        </div>
                                        {!checkingCustomer && phoneChecked && isExistingCustomer && (
                                            <p className="text-xs text-green-600 font-medium ml-1 dark:text-green-400">Cliente encontrado! Dados preenchidos.</p>
                                        )}
                                        {!checkingCustomer && phoneChecked && !isExistingCustomer && clienteTelefone.length >= 10 && (
                                            <p className="text-xs text-amber-600 font-medium ml-1 dark:text-amber-400">Cliente novo. Preencha os dados ou aguarde o modal de registro.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer de Resumo */}
                        <div className="p-6 bg-white border-t border-slate-100 space-y-4 dark:bg-slate-800 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest dark:text-slate-500">Total do Pedido</span>
                                <span className="text-2xl font-black text-slate-900 dark:text-white">
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

            {/* Modal de Seleção de Itens Compostos */}
            {isCompositeModalOpen && selectedComposite && (
                <div key="composite-modal" className="fixed inset-0 z-[160] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsCompositeModalOpen(false)}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] dark:bg-slate-800"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-gradient-to-r from-amber-50 to-orange-50 shrink-0 dark:border-slate-700 dark:from-amber-900/30 dark:to-orange-900/30">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedComposite.nome}</h2>
                                {selectedComposite.descricao && (
                                    <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">{selectedComposite.descricao}</p>
                                )}
                                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 font-medium bg-amber-100 w-fit px-2 py-1 rounded-lg dark:text-amber-400 dark:bg-amber-900/50">
                                    Escolha {selectedComposite.minimo === selectedComposite.maximo 
                                        ? `${selectedComposite.maximo} item${selectedComposite.maximo > 1 ? 'ns' : ''}`
                                        : `${selectedComposite.minimo} a ${selectedComposite.maximo} itens`}
                                </div>
                            </div>
                            <button
                                onClick={() => setIsCompositeModalOpen(false)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors shrink-0 dark:hover:bg-slate-700"
                            >
                                <X className="size-5 text-slate-500 dark:text-slate-400" />
                            </button>
                        </div>

                        {/* Lista de Itens */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar">
                            {selectedComposite.items.length === 0 ? (
                                <p className="text-center text-slate-400 py-8 dark:text-slate-500">Nenhuma opção disponível.</p>
                            ) : (
                                selectedComposite.items.map(item => {
                                    const isSelected = selectedItems.some(i => i.id === item.id);
                                    const canAdd = selectedItems.length < selectedComposite.maximo || isSelected;

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => canAdd ? toggleItemSelection(item) : undefined}
                                            disabled={!canAdd && !isSelected}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${isSelected
                                                ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-200 dark:border-amber-500 dark:bg-amber-900/30 dark:ring-amber-600'
                                                : canAdd
                                                    ? 'border-slate-100 bg-slate-50 hover:border-amber-200 hover:bg-amber-50/40 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-amber-500 dark:hover:bg-amber-900/20'
                                                    : 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed dark:border-slate-600 dark:bg-slate-800'
                                                }`}
                                        >
                                            <div className="flex-1 text-left">
                                                <p className={`text-sm font-bold ${isSelected ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>
                                                    {item.nome}
                                                </p>
                                                {Number(item.preco) > 0 && (
                                                    <p className="text-xs font-bold text-amber-600 mt-0.5 dark:text-amber-500">
                                                        {Number(item.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </p>
                                                )}
                                            </div>
                                            <div className={`size-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected
                                                ? 'bg-amber-500 border-amber-500'
                                                : 'border-slate-300 bg-white dark:bg-slate-600 dark:border-slate-500'
                                                }`}>
                                                {isSelected && <Check className="size-3.5 text-white stroke-[3]" />}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0 dark:bg-slate-700 dark:border-slate-600">
                            <button
                                disabled={selectedItems.length < selectedComposite.minimo}
                                onClick={handleAddCompositeToCart}
                                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] dark:disabled:bg-slate-600 dark:disabled:text-slate-400"
                            >
                                <Plus className="size-5" />
                                {selectedItems.length >= selectedComposite.minimo 
                                    ? 'Adicionar ao Carrinho' 
                                    : `Selecione mais ${selectedComposite.minimo - selectedItems.length} item${(selectedComposite.minimo - selectedItems.length) > 1 ? 'ns' : ''}`}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Modal de Registro de Cliente - posicionado ao lado */}
            {showRegisterModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
                    <div className="pointer-events-auto ml-[30vw]">
                        <RegisterCustomerModal
                            key="register-modal"
                            isOpen={showRegisterModal}
                            onClose={() => {
                                setShowRegisterModal(false);
                                setCustomerToRegister(null);
                            }}
                            order={customerToRegister}
                            onSuccess={() => {
                                if (customerToRegister?.telefone_cliente) {
                                    checkCustomerExists(customerToRegister.telefone_cliente);
                                }
                            }}
                        />
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
