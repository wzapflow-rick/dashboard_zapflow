'use client';

import React from 'react';
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
    LogOut
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

function playPendingSound() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(600, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
    } catch (_) { }
}

export function Header({ isOpen, setIsOpen, setIsMobileMenuOpen }: HeaderProps) {
    const [user, setUser] = React.useState<any>(null);
    const [notifications, setNotifications] = React.useState<any[]>([]);
    const [newCount, setNewCount] = React.useState<number>(0);
    const [pendingCount, setPendingCount] = React.useState<number>(0);
    const [newPendingBadge, setNewPendingBadge] = React.useState<number>(0);
    const knownIds = React.useRef<Set<number>>(new Set());
    const isFirstLoad = React.useRef(true);
    const [lastSeenId, setLastSeenId] = React.useState<number>(0);
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('lastSeenOrderId');
        if (saved) setLastSeenId(parseInt(saved, 10));
    }, []);

    React.useEffect(() => {
        import('@/app/actions/auth').then(({ getMe }) => {
            getMe().then(setUser);
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
        setNewPendingBadge(0);
        if (notifications.length > 0) {
            const maxId = Math.max(...notifications.map((n: any) => n.id || 0));
            if (maxId > lastSeenId) {
                setLastSeenId(maxId);
                localStorage.setItem('lastSeenOrderId', String(maxId));
            }
        } else if (newCount > 0) {
            // Se não temos a lista ainda mas temos o count, tentamos marcar como visto
            // No próximo fetch ele virá filtrado
            setLastSeenId(999999999); // Gambiarra temporária para limpar se não houver ids
        }
    };

    // Filtra o newCount vindo do banco pelo que já vimos
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

    return (
        <header className="h-16 bg-gradient-to-r from-white to-slate-50 border-b border-slate-200/50 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40 dark:bg-gradient-to-r dark:from-slate-900 dark:to-slate-800 dark:border-slate-700/50 shadow-sm">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg dark:text-slate-400 dark:hover:bg-slate-800"
                >
                    <LayoutDashboard className="size-6" />
                </button>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="hidden lg:flex p-2 text-slate-500 hover:bg-slate-100 rounded-lg dark:text-slate-400 dark:hover:bg-slate-800"
                >
                    <LayoutDashboard className="size-6" />
                </button>
            </div>

            <div className="flex items-center gap-4">
                {pendingCount > 0 && (
                    <a href="/dashboard/expedition" className="hidden sm:flex items-center gap-2 text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-all text-xs font-bold dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50">
                        <ShoppingBag className="size-4" />
                        {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                    </a>
                )}

                <div className="relative group">
                    <button
                        className="p-2 text-slate-400 hover:text-slate-600 relative dark:text-slate-500 dark:hover:text-slate-300"
                        onClick={handleBellClick}
                    >
                        <Bell className="size-5" />
                        {totalBadge > 0 && (
                            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white">
                                {totalBadge > 9 ? '9+' : totalBadge}
                            </span>
                        )}
                    </button>

                    <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 dark:bg-slate-800 dark:border-slate-700">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-white">Notificações</h3>
                            {totalBadge > 0 ? (
                                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{totalBadge} Novas</span>
                            ) : (
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full dark:bg-slate-700 dark:text-slate-400">Nenhuma</span>
                            )}
                        </div>
                        <div className="max-h-[320px] overflow-y-auto">
                            {newPendingBadge > 0 && (
                                <div className="p-4 hover:bg-amber-50 border-b border-slate-50 cursor-pointer transition-colors dark:hover:bg-amber-900/20 dark:border-slate-700">
                                    <div className="flex gap-3">
                                        <div className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                                            <ShoppingBag className="size-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {newPendingBadge} novo{newPendingBadge !== 1 ? 's' : ''} pedido{newPendingBadge !== 1 ? 's' : ''}!
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Acesse a Expedição para aceitar</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {notifications.length > 0 ? (
                                notifications.map((notif, i) => {
                                    const Icon = getIcon(notif.iconType);
                                    return (
                                        <div key={i} className="p-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 cursor-pointer transition-colors dark:hover:bg-slate-700 dark:border-slate-700">
                                            <div className="flex gap-3">
                                                <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", notif.color)}>
                                                    <Icon className="size-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900 truncate dark:text-white">{notif.title}</p>
                                                    <p className="text-xs text-slate-500 truncate dark:text-slate-400">{notif.desc}</p>
                                                    <p className="text-[10px] text-slate-400 mt-1 dark:text-slate-500">{notif.time}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : newPendingBadge === 0 ? (
                                <div className="p-4 text-center text-slate-500 text-sm dark:text-slate-400">
                                    Nenhuma notificação recente.
                                </div>
                            ) : null}
                        </div>
                        <div className="p-3 text-center border-t border-slate-100 dark:border-slate-700">
                            <a href="/dashboard/expedition" className="text-xs font-bold text-primary hover:underline">Ver todos os pedidos</a>
                        </div>
                    </div>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden sm:block dark:bg-slate-700"></div>
                <div className="relative group">
                    <button
                        className="hidden sm:flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium text-sm dark:text-slate-300 dark:hover:text-white"
                    >
                        <span>{user?.nome || 'Minha Loja'}</span>
                        <ChevronDown className="size-4" />
                    </button>

                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 dark:bg-slate-800 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                        <p className="font-bold text-slate-800 truncate dark:text-white">{user?.nome || 'Minha Loja'}</p>
                        <p className="text-xs text-slate-500 truncate dark:text-slate-400">{user?.email}</p>
                        {user?.role && !['admin', 'gerente'].includes(user.role) && (
                            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                {user.role === 'atendente' ? 'Atendente' : user.role === 'cozinheiro' ? 'Cozinheiro' : user.role}
                            </span>
                        )}
                        {user?.role === 'gerente' && (
                            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                Gerente
                            </span>
                        )}
                    </div>
                        <div className="p-2">
                            <button
                                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                                {mounted ? (isDark ? <Sun className="size-4" /> : <Moon className="size-4" />) : <div className="size-4" />}
                                <span>{mounted ? (isDark ? 'Modo Claro' : 'Modo Escuro') : 'Carregando...'}</span>
                            </button>
                            <button
                                onClick={async () => {
                                    const { logout } = await import('@/app/actions/auth');
                                    await logout();
                                    window.location.href = '/';
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                                <LogOut className="size-4" />
                                <span>Sair</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
