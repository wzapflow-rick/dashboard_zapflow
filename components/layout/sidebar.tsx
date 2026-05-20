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
    X,
    PackageOpen,
    Star,
    DollarSign,
    LayoutGrid,
    Lightbulb,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';

const navItems = [
    { name: 'Visão Geral', href: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
    { name: 'Insights', href: '/dashboard/insights', icon: Lightbulb, roles: ['admin', 'gerente'] },
    { name: 'Cardápio', href: '/dashboard/menu', icon: UtensilsCrossed, roles: ['admin'] },
    { name: 'Expedição', href: '/dashboard/expedition', icon: Truck, roles: ['admin', 'gerente', 'atendente', 'cozinheiro'] },
    { name: 'Mesas', href: '/dashboard/mesas', icon: LayoutGrid, roles: ['admin', 'gerente', 'atendente'] },
    { name: 'Clientes', href: '/dashboard/customers', icon: Users, roles: ['admin', 'gerente', 'atendente'] },
    { name: 'Divulgação', href: '/dashboard/growth', icon: Megaphone, roles: ['admin'] },
    { name: 'Campanhas', href: '/dashboard/campanhas', icon: Megaphone, roles: ['admin'] },
    { name: 'Insumos', href: '/dashboard/insumos', icon: PackageOpen, roles: ['admin'] },
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
    user?: any;
}

// Componente de item do menu com animacoes
function NavItem({ 
    item, 
    isActive, 
    isOpen, 
    isMobileMenuOpen, 
    onClick,
    index 
}: { 
    item: typeof navItems[0]; 
    isActive: boolean; 
    isOpen: boolean; 
    isMobileMenuOpen: boolean;
    onClick: () => void;
    index: number;
}) {
    return (
        <motion.a
            href={item.href}
            onClick={onClick}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03, duration: 0.3 }}
            className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300",
                isActive
                    ? "bg-gradient-to-r from-primary/20 to-primary/5 text-primary"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
        >
            {/* Barra indicadora lateral animada */}
            <AnimatePresence>
                {isActive && (
                    <motion.div
                        layoutId="activeIndicator"
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-full"
                    />
                )}
            </AnimatePresence>

            {/* Icone com efeito de glow quando ativo */}
            <div className={cn(
                "relative flex items-center justify-center size-9 rounded-lg transition-all duration-300",
                isActive 
                    ? "bg-primary/20 shadow-[0_0_20px_rgba(34,197,94,0.3)]" 
                    : "bg-white/5 group-hover:bg-white/10"
            )}>
                <item.icon className={cn(
                    "size-[18px] transition-all duration-300",
                    isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-200"
                )} />
            </div>

            {/* Nome do item com animacao */}
            {(isOpen || isMobileMenuOpen) && (
                <motion.span 
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className={cn(
                        "text-sm font-medium whitespace-nowrap transition-colors duration-300",
                        isActive ? "text-primary font-semibold" : "text-slate-300 group-hover:text-white"
                    )}
                >
                    {item.name}
                </motion.span>
            )}

            {/* Seta indicadora no hover */}
            {(isOpen || isMobileMenuOpen) && !isActive && (
                <ChevronRight className="size-4 text-slate-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ml-auto" />
            )}
        </motion.a>
    );
}

export function Sidebar({ isOpen, isMobileMenuOpen, setIsMobileMenuOpen, user }: SidebarProps) {
    const pathname = usePathname();

    if (user?.role === 'cozinheiro') {
        return null;
    }

    const closeMobileMenu = () => {
        if (isMobileMenuOpen) {
            setIsMobileMenuOpen(false);
        }
    };

    const filteredNavItems = navItems
        .filter(item => {
            if (!user?.controle_estoque && item.name === 'Insumos') {
                return false;
            }
            return true;
        })
        .filter(item => {
            if (user?.role && user.role !== 'admin') {
                return item.roles?.includes(user.role);
            }
            return true;
        });

    const filteredAdminItems = adminItems.filter(item => {
        if (user?.role && user.role !== 'admin') {
            return item.roles?.includes(user.role);
        }
        return true;
    });

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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
                    />
                )}
            </AnimatePresence>

            <aside
                className={cn(
                    "fixed left-0 top-0 h-full transition-all duration-300 z-[70] flex flex-col",
                    // Background com gradiente sutil e borda
                    "bg-gradient-to-b from-[#0c1929] via-[#0a1525] to-[#081220]",
                    "border-r border-white/5",
                    // Sombra sutil
                    "shadow-[4px_0_24px_rgba(0,0,0,0.3)]",
                    isOpen ? "w-64" : "w-20",
                    "lg:translate-x-0",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Header com logo */}
                <div className="p-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {/* Logo com efeito de glow */}
                        <motion.div 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="relative size-11 rounded-xl overflow-hidden shrink-0 shadow-lg ring-2 ring-primary/20"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
                            <Image
                                src="/logo-zapflow.png"
                                alt="ZapFlow"
                                width={44}
                                height={44}
                                className="object-cover relative z-10"
                            />
                        </motion.div>
                        
                        {(isOpen || isMobileMenuOpen) && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className="flex flex-col"
                            >
                                <h1 className="font-bold text-white leading-none truncate w-32 text-[15px]">
                                    {user?.nome || 'ZapFlow'}
                                </h1>
                                <p className="text-[10px] text-primary/80 mt-1.5 uppercase tracking-widest font-bold flex items-center gap-1">
                                    <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                                    Made by ZapFlow
                                </p>
                            </motion.div>
                        )}
                    </div>
                    
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* Navegacao principal */}
                <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto custom-scrollbar">
                    {filteredNavItems.map((item, index) => (
                        <NavItem
                            key={item.name}
                            item={item}
                            isActive={pathname === item.href}
                            isOpen={isOpen}
                            isMobileMenuOpen={isMobileMenuOpen}
                            onClick={closeMobileMenu}
                            index={index}
                        />
                    ))}

                    {/* Secao Administracao */}
                    {filteredAdminItems.length > 0 && (
                        <div className="pt-4 mt-4">
                            {/* Separador com gradiente */}
                            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />
                            
                            {(isOpen || isMobileMenuOpen) && (
                                <motion.span 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 block"
                                >
                                    Administração
                                </motion.span>
                            )}
                            
                            <div className="space-y-1">
                                {filteredAdminItems.map((item, index) => (
                                    <NavItem
                                        key={item.name}
                                        item={item}
                                        isActive={pathname === item.href}
                                        isOpen={isOpen}
                                        isMobileMenuOpen={isMobileMenuOpen}
                                        onClick={closeMobileMenu}
                                        index={filteredNavItems.length + index}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </nav>

                {/* Footer com perfil do usuario */}
                <div className="p-3 mt-auto">
                    {/* Separador superior */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" />
                    
                    <motion.div 
                        whileHover={{ scale: 1.02 }}
                        className="flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl cursor-pointer transition-all duration-300 group"
                    >
                        {/* Avatar com ring animado */}
                        <div className="relative">
                            <div className="relative size-10 rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-primary/30 transition-all duration-300">
                                <Image
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDm72iK3QVpJIMCWIHbWsRreh_QjkigiEYJ2gtcc6GqtkJAiL6-wR2AENgEq-Hrh8EA_6Yyyp_9TLAAg2R_RuFBNgiB9XbHm2Ny79MIfLQ3rMDm7alfZlyysgKOr16OG9gZZtvomKL1wz4cO-B6LuKMIBJJGkki0Fl3AbtpFUuZSBCKKgAMPAJZdTLel0MzOOPREwzSyK6_LPuFIa0zv1mHtyb3b_dJJrInLPf58HW0YS2CWO27sZamwhRyxsI0vDyhdFjw9DKBsYM"
                                    alt="Profile"
                                    fill
                                    className="object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            </div>
                            {/* Indicador de status online */}
                            <span className="absolute -bottom-0.5 -right-0.5 size-3 bg-primary rounded-full border-2 border-[#0c1929]" />
                        </div>
                        
                        {(isOpen || isMobileMenuOpen) && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex flex-col overflow-hidden flex-1"
                            >
                                <span className="text-sm font-semibold text-white leading-tight truncate group-hover:text-primary transition-colors">
                                    {user?.nome || 'Minha Loja'}
                                </span>
                                <span className="text-xs text-slate-500 capitalize flex items-center gap-1.5">
                                    <span className="size-1 rounded-full bg-primary" />
                                    Plano {user?.plano || 'Iniciante'}
                                </span>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            </aside>
        </>
    );
}
