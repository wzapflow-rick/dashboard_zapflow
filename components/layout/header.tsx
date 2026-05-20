'use client';

import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Bell,
    ChevronDown,
    Truck,
    CreditCard,
    UtensilsCrossed,
    X,
    ShoppingBag,
    Moon,
    Sun,
    LogOut,
    Sparkles,
    Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface HeaderProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    setIsMobileMenuOpen: (open: boolean) => void;
}

function playNewOrderSound() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, ctx.currentTime);
        gain1.gain.setValueAtTime(0.4, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1600, ctx.currentTime + 0.15);
        gain2.gain.setValueAtTime(0.4, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.35);
    } catch (_) { }
}

export function Header({ isOpen, setIsOpen, setIsMobileMenuOpen }: HeaderProps) {
    const [user, setUser] = React.useState<any>(null);
    const [empresaData, setEmpresaData] = React.useState<any>(null);
    const [notifications, setNotifications] = React.useState<any[]>([]);
    const [newCount, setNewCount] = React.useState<number>(0);
    const [pendingCount, setPendingCount] = React.useState<number>(0);
    const [newPendingBadge, setNewPendingBadge] = React.useState<number>(0);
    const knownIds = React.useRef<Set<number>>(new Set());
    const isFirstLoad = React.useRef(true);
    const [lastSeenId, setLastSeenId] = React.useState<number>(0);
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);
    const [isNotifOpen, setIsNotifOpen] = React.useState(false);
    const [isProfileOpen, setIsProfileOpen] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('lastSeenOrderId');
        if (saved) setLastSeenId(parseInt(saved, 10));
    }, []);

    React.useEffect(() => {
        import('@/app/actions/auth').then(({ getMe, getEmpresaData }) => {
            getMe().then(setUser);
            getEmpresaData().then(data => {
                console.log('[v0] Header empresaData:', data);
                setEmpresaData(data);
            });
        });

        import('@/app/actions/notifications').then(({ getNotifications }) => {
            getNotifications().then(data => {
                setNotifications(data.notifications || []);
                setNewCount(data.newCount || 0);
            });
        });
    }, []);

    React.useEffect(() => {
        const checkOrders = async () => {
            try {
                const { getOrders } = await import('@/app/actions/orders');
                const allOrders = await getOrders();
                const pendingOrders = allOrders.filter((o: any) => o.status === 'pendente');
                const ids = pendingOrders.map((o: any) => o.id);
                setPendingCount(ids.length);

                if (isFirstLoad.current) {
                    ids.forEach((id: number) => knownIds.current.add(id));
                    isFirstLoad.current = false;
                    return;
                }

                const newOrders = ids.filter((id: number) => !knownIds.current.has(id));
                if (newOrders.length > 0) {
                    newOrders.forEach((id: number) => knownIds.current.add(id));
                    setNewPendingBadge(prev => prev + newOrders.length);
                    playNewOrderSound();
                }

                const currentSet = new Set(ids);
                knownIds.current.forEach(id => {
                    if (!currentSet.has(id)) knownIds.current.delete(id);
                });
            } catch (_) { }
        };

        checkOrders();
        const interval = setInterval(checkOrders, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleBellClick = () => {
        setIsNotifOpen(!isNotifOpen);
        setIsProfileOpen(false);
        setNewPendingBadge(0);
        if (notifications.length > 0) {
            const maxId = Math.max(...notifications.map((n: any) => n.id || 0));
            if (maxId > lastSeenId) {
                setLastSeenId(maxId);
                localStorage.setItem('lastSeenOrderId', String(maxId));
            }
        }
    };

    const activeNewCount = notifications.filter((n: any) => n.status === 'pendente' && n.id > lastSeenId).length;
    const totalBadge = newPendingBadge + activeNewCount;

    const getIcon = (iconType: string) => {
        switch (iconType) {
            case 'truck': return Truck;
            case 'utensils': return UtensilsCrossed;
            case 'creditcard': return CreditCard;
            case 'cancel': return X;
            default: return Bell;
        }
    };

    const isDark = theme === 'dark';
    const isCozinheiro = user?.role === 'cozinheiro';

    // Close dropdowns when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.notif-dropdown') && !target.closest('.profile-dropdown')) {
                setIsNotifOpen(false);
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <header className="h-16 sticky top-0 z-40">
            {/* Glassmorphism background */}
            <div className="absolute inset-0 bg-white/70 dark:bg-[#0a1628]/80 backdrop-blur-xl border-b border-white/20 dark:border-white/5" />
            
            {/* Gradient accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            <div className="relative h-full px-4 lg:px-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {!isCozinheiro && (
                        <>
                            {/* Mobile menu button */}
                            <motion.button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className="lg:hidden p-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-xl bg-slate-100/50 dark:bg-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all"
                                whileTap={{ scale: 0.95 }}
                            >
                                <LayoutDashboard className="size-5" />
                            </motion.button>
                            
                            {/* Desktop sidebar toggle */}
                            <motion.button
                                onClick={() => setIsOpen(!isOpen)}
                                className="hidden lg:flex p-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-xl bg-slate-100/50 dark:bg-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all"
                                whileTap={{ scale: 0.95 }}
                                whileHover={{ rotate: isOpen ? 0 : 180 }}
                                transition={{ duration: 0.3 }}
                            >
                                <LayoutDashboard className="size-5" />
                            </motion.button>
                        </>
                    )}
                    
                    {isCozinheiro && (
                        <div className="flex items-center gap-3">
                            <motion.div 
                                className="size-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-orange-500/25"
                                whileHover={{ scale: 1.05, rotate: 5 }}
                            >
                                <Truck className="size-5" />
                            </motion.div>
                            <h1 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">Expedicao</h1>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Pending orders badge */}
                    <AnimatePresence>
                        {pendingCount > 0 && (
                            <motion.a 
                                href="/dashboard/expedition" 
                                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10"
                                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.8, x: 20 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <motion.div
                                    animate={{ rotate: [0, -10, 10, -10, 0] }}
                                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
                                >
                                    <ShoppingBag className="size-4" />
                                </motion.div>
                                <span>{pendingCount} pendente{pendingCount !== 1 ? 's' : ''}</span>
                            </motion.a>
                        )}
                    </AnimatePresence>

                    {/* Notification bell */}
                    <div className="relative notif-dropdown">
                        <motion.button
                            className="relative p-2.5 rounded-xl bg-slate-100/50 dark:bg-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all"
                            onClick={handleBellClick}
                            whileTap={{ scale: 0.95 }}
                            whileHover={{ scale: 1.05 }}
                        >
                            <motion.div
                                animate={totalBadge > 0 ? { rotate: [0, -15, 15, -15, 15, 0] } : {}}
                                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 4 }}
                            >
                                <Bell className="size-5 text-slate-500 dark:text-slate-400" />
                            </motion.div>
                            
                            {/* Animated badge */}
                            <AnimatePresence>
                                {totalBadge > 0 && (
                                    <motion.span 
                                        className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-red-500/30"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        exit={{ scale: 0 }}
                                    >
                                        <motion.span
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ duration: 1, repeat: Infinity }}
                                        >
                                            {totalBadge > 9 ? '9+' : totalBadge}
                                        </motion.span>
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </motion.button>

                        {/* Notifications dropdown */}
                        <AnimatePresence>
                            {isNotifOpen && (
                                <motion.div 
                                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl overflow-hidden z-50"
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                >
                                    {/* Glass background */}
                                    <div className="absolute inset-0 bg-white/90 dark:bg-[#0f1f35]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30" />
                                    
                                    <div className="relative">
                                        {/* Header */}
                                        <div className="p-4 border-b border-slate-200/50 dark:border-white/5 flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-primary/10">
                                                    <Bell className="size-4 text-primary" />
                                                </div>
                                                <h3 className="font-bold text-slate-800 dark:text-white">Notificacoes</h3>
                                            </div>
                                            {totalBadge > 0 ? (
                                                <motion.span 
                                                    className="text-[10px] font-bold bg-gradient-to-r from-primary/20 to-emerald-500/20 text-primary px-3 py-1 rounded-full"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                >
                                                    {totalBadge} Nova{totalBadge !== 1 ? 's' : ''}
                                                </motion.span>
                                            ) : (
                                                <span className="text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-full">
                                                    Em dia
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Notifications list */}
                                        <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                                            {newPendingBadge > 0 && (
                                                <motion.a
                                                    href="/dashboard/expedition"
                                                    className="block p-4 hover:bg-amber-50/50 dark:hover:bg-amber-500/10 border-b border-slate-100/50 dark:border-white/5 transition-colors"
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                >
                                                    <div className="flex gap-3">
                                                        <motion.div 
                                                            className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25"
                                                            animate={{ scale: [1, 1.1, 1] }}
                                                            transition={{ duration: 1, repeat: Infinity }}
                                                        >
                                                            <Sparkles className="size-5" />
                                                        </motion.div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                                {newPendingBadge} novo{newPendingBadge !== 1 ? 's' : ''} pedido{newPendingBadge !== 1 ? 's' : ''}!
                                                            </p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Clique para ver na Expedicao</p>
                                                        </div>
                                                    </div>
                                                </motion.a>
                                            )}
                                            
                                            {notifications.length > 0 ? (
                                                notifications.map((notif, i) => {
                                                    const Icon = getIcon(notif.iconType);
                                                    return (
                                                        <motion.div 
                                                            key={i} 
                                                            className="p-4 hover:bg-slate-50/50 dark:hover:bg-white/5 border-b border-slate-100/50 dark:border-white/5 last:border-0 cursor-pointer transition-colors"
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: i * 0.05 }}
                                                        >
                                                            <div className="flex gap-3">
                                                                <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", notif.color)}>
                                                                    <Icon className="size-4" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-semibold text-slate-900 truncate dark:text-white">{notif.title}</p>
                                                                    <p className="text-xs text-slate-500 truncate dark:text-slate-400 mt-0.5">{notif.desc}</p>
                                                                    <p className="text-[10px] text-slate-400 mt-1 dark:text-slate-500">{notif.time}</p>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })
                                            ) : newPendingBadge === 0 ? (
                                                <div className="p-8 text-center">
                                                    <div className="size-12 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                                                        <Bell className="size-6 text-slate-400" />
                                                    </div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma notificacao recente</p>
                                                </div>
                                            ) : null}
                                        </div>
                                        
                                        {/* Footer */}
                                        <div className="p-3 text-center border-t border-slate-100/50 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                                            <a href="/dashboard/expedition" className="text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                                                Ver todos os pedidos
                                            </a>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Divider */}
                    <div className="h-8 w-px bg-slate-200/50 dark:bg-white/10 hidden sm:block" />

                    {/* Profile dropdown */}
                    <div className="relative profile-dropdown">
                        <motion.button
                            className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100/50 dark:hover:bg-white/5 transition-all"
                            onClick={() => {
                                setIsProfileOpen(!isProfileOpen);
                                setIsNotifOpen(false);
                            }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {/* Avatar */}
                            <div className="relative">
                                {empresaData?.logo_url ? (
                                    <div className="size-8 rounded-lg overflow-hidden shadow-lg shadow-primary/20 ring-2 ring-primary/20">
                                        <Image
                                            src={empresaData.logo_url}
                                            alt="Logo"
                                            width={32}
                                            height={32}
                                            className="object-cover size-full"
                                        />
                                    </div>
                                ) : (
                                    <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary/20">
                                        {user?.nome?.charAt(0)?.toUpperCase() || 'Z'}
                                    </div>
                                )}
                                <div className="absolute -bottom-0.5 -right-0.5 size-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0a1628]" />
                            </div>
                            
                            <div className="text-left hidden lg:block">
                                <p className="text-sm font-semibold text-slate-700 dark:text-white truncate max-w-[120px]">
                                    {user?.nome || 'Minha Loja'}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {user?.role === 'gerente' ? 'Gerente' : 'Administrador'}
                                </p>
                            </div>
                            
                            <motion.div
                                animate={{ rotate: isProfileOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown className="size-4 text-slate-400" />
                            </motion.div>
                        </motion.button>

                        {/* Profile dropdown menu */}
                        <AnimatePresence>
                            {isProfileOpen && (
                                <motion.div 
                                    className="absolute right-0 mt-2 w-64 rounded-2xl overflow-hidden z-50"
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                >
                                    {/* Glass background */}
                                    <div className="absolute inset-0 bg-white/90 dark:bg-[#0f1f35]/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30" />
                                    
                                    <div className="relative">
                                        {/* User info */}
                                        <div className="p-4 border-b border-slate-200/50 dark:border-white/5">
                                            <div className="flex items-center gap-3">
                                                {empresaData?.logo_url ? (
                                                    <div className="size-12 rounded-xl overflow-hidden shadow-lg shadow-primary/20 ring-2 ring-primary/20">
                                                        <Image
                                                            src={empresaData.logo_url}
                                                            alt="Logo"
                                                            width={48}
                                                            height={48}
                                                            className="object-cover size-full"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="size-12 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/20">
                                                        {user?.nome?.charAt(0)?.toUpperCase() || 'Z'}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-800 truncate dark:text-white">{user?.nome || 'Minha Loja'}</p>
                                                    <p className="text-xs text-slate-500 truncate dark:text-slate-400">{user?.email}</p>
                                                </div>
                                            </div>
                                            
                                            {user?.role && (
                                                <div className="mt-3 flex gap-2">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold",
                                                        user.role === 'gerente' 
                                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                                                            : user.role === 'cozinheiro'
                                                            ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
                                                            : user.role === 'atendente'
                                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                                                            : "bg-primary/10 text-primary"
                                                    )}>
                                                        {user.role === 'gerente' ? 'Gerente' : 
                                                         user.role === 'cozinheiro' ? 'Cozinheiro' : 
                                                         user.role === 'atendente' ? 'Atendente' : 'Admin'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Menu items */}
                                        <div className="p-2">
                                            <motion.a
                                                href="/dashboard/settings"
                                                className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/5 rounded-xl transition-colors"
                                                whileHover={{ x: 4 }}
                                            >
                                                <Settings className="size-4" />
                                                <span>Configuracoes</span>
                                            </motion.a>
                                            
                                            <motion.button
                                                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/5 rounded-xl transition-colors"
                                                whileHover={{ x: 4 }}
                                            >
                                                {mounted ? (isDark ? <Sun className="size-4" /> : <Moon className="size-4" />) : <div className="size-4" />}
                                                <span>{mounted ? (isDark ? 'Modo Claro' : 'Modo Escuro') : 'Carregando...'}</span>
                                            </motion.button>
                                            
                                            <div className="my-2 h-px bg-slate-200/50 dark:bg-white/5" />
                                            
                                            <motion.button
                                                onClick={async () => {
                                                    const { logout } = await import('@/app/actions/auth');
                                                    await logout();
                                                    window.location.href = '/';
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                                                whileHover={{ x: 4 }}
                                            >
                                                <LogOut className="size-4" />
                                                <span>Sair da conta</span>
                                            </motion.button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
}
