'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import { Users, Plus, Trash2, Shield, UserCheck, Loader2, X } from 'lucide-react';
import { getUsers, createUser, deleteUser } from '@/app/actions/users';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    atendente: 'Atendente',
};

const ROLE_PERMS: Record<string, string[]> = {
    admin: ['Acesso completo ao sistema'],
    atendente: ['Expedição (Kanban)', 'Clientes'],
};

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ nome: '', email: '', senha: '', role: 'atendente' });

    const load = async () => {
        setLoading(true);
        const data = await getUsers();
        setUsers(data);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nome || !form.email || !form.senha) {
            toast.error('Preencha todos os campos.');
            return;
        }
        try {
            setSaving(true);
            await createUser(form);
            toast.success('Usuário criado com sucesso!');
            setShowModal(false);
            setForm({ nome: '', email: '', senha: '', role: 'atendente' });
            await load();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao criar usuário.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number, nome: string) => {
        if (!confirm(`Remover o usuário "${nome}"?`)) return;
        try {
            await deleteUser(id);
            toast.success('Usuário removido.');
            await load();
        } catch (err: any) {
            toast.error(err.message || 'Erro ao remover usuário.');
        }
    };

    return (
        <SidebarProvider>
            <DashboardLayout>
                <div className="space-y-8">
                    <header className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Equipe</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie os atendentes da sua loja.</p>
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 bg-primary text-white font-bold px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-all"
                        >
                            <Plus className="size-4" />
                            Adicionar
                        </button>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(ROLE_PERMS).map(([role, perms]) => (
                            <div key={role} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    {role === 'admin' ? <Shield className="size-4 text-violet-600 dark:text-violet-400" /> : <UserCheck className="size-4 text-blue-500" />}
                                    <span className="font-bold text-slate-800 dark:text-white">{ROLE_LABELS[role]}</span>
                                </div>
                                <ul className="space-y-1">
                                    {perms.map(p => (
                                        <li key={p} className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                            <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                                            {p}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="flex justify-center items-center py-16">
                                <Loader2 className="size-7 animate-spin text-primary" />
                            </div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                                <Users className="size-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                <p className="font-medium">Nenhum atendente cadastrado.</p>
                                <p className="text-sm mt-1">Adicione membros para que eles acessem a expedição.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nome</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">E-mail</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Perfil</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                                                        {u.nome?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <span className="font-semibold text-slate-900 dark:text-white text-sm">{u.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{u.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
                                                    {ROLE_LABELS[u.role] || u.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(u.id, u.nome)}
                                                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {showModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Novo Usuário</h2>
                                <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
                                    <X className="size-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreate} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={form.nome}
                                        onChange={e => setForm({ ...form, nome: e.target.value })}
                                        placeholder="Maria Silva"
                                        className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">E-mail</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                        placeholder="atendente@loja.com"
                                        className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">Senha</label>
                                    <input
                                        type="password"
                                        value={form.senha}
                                        onChange={e => setForm({ ...form, senha: e.target.value })}
                                        placeholder="Mínimo 6 caracteres"
                                        className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">Perfil</label>
                                    <select
                                        value={form.role}
                                        onChange={e => setForm({ ...form, role: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                                    >
                                        <option value="atendente">Atendente (Kanban + Clientes)</option>
                                        <option value="admin">Administrador (Acesso Completo)</option>
                                    </select>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setShowModal(false)}
                                        className="flex-1 py-3 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={saving}
                                        className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                                        {saving ? <Loader2 className="size-4 animate-spin" /> : 'Criar Usuário'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </DashboardLayout>
        </SidebarProvider>
    );
}