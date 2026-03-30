'use client';

import React, { useState } from 'react';
import { X, User, Phone, MapPin, Home, CheckCircle2, Loader2 } from 'lucide-react';
import { upsertCustomer } from '@/app/actions/customers';

interface RegisterCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any;
    onSuccess: () => void;
}

export default function RegisterCustomerModal({ isOpen, onClose, order, onSuccess }: RegisterCustomerModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nome: '',
        telefone: order?.telefone_cliente || '',
        bairro_entrega: order?.bairro_entrega || '',
        endereco_completo: '',
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await upsertCustomer(formData);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Erro ao registrar cliente:', error);
            alert('Falha ao registrar cliente. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary/20 rounded-full flex items-center justify-center">
                            <User className="size-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold leading-none">Registrar Cliente</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">Vincular pedido ao cadastro</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="size-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome do Cliente (Opcional)</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                            <input
                                value={formData.nome}
                                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                placeholder="Ex: João Silva"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">WhatsApp / Telefone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                            <input
                                value={formData.telefone}
                                readOnly
                                className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bairro</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                            <input
                                value={formData.bairro_entrega}
                                onChange={e => setFormData({ ...formData, bairro_entrega: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                placeholder="Ex: Centro"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Endereço Completo (Opcional)</label>
                        <div className="relative">
                            <Home className="absolute left-3 top-3 size-4 text-slate-300" />
                            <textarea
                                value={formData.endereco_completo}
                                onChange={e => setFormData({ ...formData, endereco_completo: e.target.value })}
                                rows={3}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                                placeholder="Rua, Número, Complemento..."
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors uppercase tracking-wider"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] py-3 bg-primary text-white text-sm font-black rounded-xl hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 uppercase tracking-widest"
                        >
                            {loading ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="size-4" />
                            )}
                            Finalizar Registro
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
