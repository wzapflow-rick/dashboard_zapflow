'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    UtensilsCrossed,
    Truck,
    Users,
    Megaphone,
    Settings,
    CreditCard,
    Bolt,
    X,
    PackageOpen,
    FlaskConical,
    Star,
    DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';

const navItems = [
    { name: 'Visão Geral', href: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
    { name: 'Cardápio', href: '/dashboard/menu', icon: UtensilsCrossed, roles: ['admin'] },
    { name: 'Insumos', href: '/dashboard/insumos', icon: PackageOpen, roles: ['admin'] },
    { name: 'Expedição', href: '/dashboard/expedition', icon: Truck, roles: ['admin', 'gerente', 'atendente', 'cozinheiro'] },
    { name: 'Clientes', href: '/dashboard/customers', icon: Users, roles: ['admin', 'gerente', 'atendente'] },
    { name: 'Divulgação', href: '/dashboard/growth', icon: Megaphone, roles: ['admin'] },
    { name: 'Módulo de Testes', href: '/dashboard/testes', icon: FlaskConical, roles: ['admin'] },
];

const adminItems = [
    { name: 'Avaliações', href: '/dashboard/ratings', icon: Star, roles: ['admin', 'gerente'] },
    { name: 'Usuários', href: '/dashboard/users', icon: Users, roles: ['admin'] },
    { name: 'Acertos', href: '/dashboard/acertos', icon: DollarSign, roles: ['admin', 'gerente'] },
    { name: 'Relatórios', href: '/dashboard/reports', icon: DollarSign, roles: ['admin', 'gerente'] },
    { name: 'Configurações', href: '/dashboard/settings', icon: Settings, roles: ['admin'] },
    { name: 'Assinatura', href: '/dashboard/subscription', icon: CreditCard, roles: ['admin'] },
];

interface SidebarProps {
    isOpen: boolean;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
}

export function Sidebar({ isOpen, isMobileMenuOpen, setIsMobileMenuOpen }: SidebarProps) {
    const pathname = usePathname();
    const [user, setUser] = React.useState<any>(null);

    React.useEffect(() => {
        import('@/app/actions/auth').then(({ getMe }) => {
            getMe().then(setUser);
        });
    }, []);

    const closeMobileMenu = () => {
        if (isMobileMenuOpen) {
            setIsMobileMenuOpen(false);
        }
    };

    return (
        <>
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] lg:hidden"
                    />
                )}
            </AnimatePresence>

            <aside
                className={cn(
                    "fixed left-0 top-0 h-full bg-white border-r border-slate-200 transition-all duration-300 z-[70] flex flex-col",
                    isOpen ? "w-64" : "w-20",
                    "lg:translate-x-0",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                    "dark:bg-slate-900 dark:border-slate-700"
                )}
            >
                <div className="p-6 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary rounded-lg flex items-center justify-center text-white shrink-0">
                            <Bolt className="size-6" />
                        </div>
                        {(isOpen || isMobileMenuOpen) && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col"
                            >
                                <h1 className="font-bold text-slate-900 leading-none truncate w-32 dark:text-white">{user?.nome || 'ZapFlow'}</h1>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold dark:text-slate-400">Made by ZapFlow</p>
                            </motion.div>
                        )}
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="lg:hidden p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto custom-scrollbar">
                    {navItems
                        .filter(item => {
                            if (!user?.controle_estoque) {
                                return item.name !== 'Insumos' && item.name !== 'Módulo de Testes';
                            }
                            return true;
                        })
                        .filter(item => {
                            if (user?.role && user.role !== 'admin') {
                                return item.roles?.includes(user.role);
                            }
                            return true;
                        })
                        .map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <a
                                    key={item.name}
                                    href={item.href}
                                    onClick={closeMobileMenu}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                                        isActive
                                            ? "bg-primary/10 text-primary font-bold"
                                            : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                                    )}
                                >
                                    <item.icon className={cn("size-5 shrink-0", isActive ? "text-primary" : "text-slate-500 dark:text-slate-400")} />
                                    {(isOpen || isMobileMenuOpen) && <span className="dark:text-slate-300">{item.name}</span>}
                                </a>
                            );
                        })}

                    <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
                        {(isOpen || isMobileMenuOpen) && (
                            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block dark:text-slate-500">
                                Administração
                            </span>
                        )}
                        {adminItems
                            .filter(item => {
                                if (user?.role && user.role !== 'admin') {
                                    return item.roles?.includes(user.role);
                                }
                                return true;
                            })
                            .map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <a
                                        key={item.name}
                                        href={item.href}
                                        onClick={closeMobileMenu}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                                            isActive
                                                ? "bg-primary/10 text-primary font-bold"
                                                : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                                        )}
                                    >
                                        <item.icon className={cn("size-5 shrink-0", isActive ? "text-primary" : "text-slate-500 dark:text-slate-400")} />
                                        {(isOpen || isMobileMenuOpen) && <span className="dark:text-slate-300">{item.name}</span>}
                                    </a>
                                );
                            })}
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors dark:hover:bg-slate-800">
                        <div className="relative size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs overflow-hidden shrink-0">
                            <Image
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDm72iK3QVpJIMCWIHbWsRreh_QjkigiEYJ2gtcc6GqtkJAiL6-wR2AENgEq-Hrh8EA_6Yyyp_9TLAAg2R_RuFBNgiB9XbHm2Ny79MIfLQ3rMDm7alfZlyysgKOr16OG9gZZtvomKL1wz4cO-B6LuKMIBJJGkki0Fl3AbtpFUuZSBCKKgAMPAJZdTLel0MzOOPREwzSyK6_LPuFIa0zv1mHtyb3b_dJJrInLPf58HW0YS2CWO27sZamwhRyxsI0vDyhdFjw9DKBsYM"
                                alt="Profile"
                                fill
                                className="object-cover"
                                referrerPolicy="no-referrer"
                            />
                        </div>
                        {(isOpen || isMobileMenuOpen) && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col overflow-hidden"
                            >
                                <span className="text-sm font-semibold text-slate-900 leading-tight truncate dark:text-white">{user?.nome || 'Minha Loja'}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Plano Pro</span>
                            </motion.div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}