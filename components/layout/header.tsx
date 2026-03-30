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
    ShoppingBag
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    setIsMobileMenuOpen: (open: boolean) => void;
}

// Beep via Web Audio API — no file needed
function playNotificationBeep() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.4);
    } catch (_) { /* ignore */ }
}

export function Header({ isOpen, setIsOpen, setIsMobileMenuOpen }: HeaderProps) {
    const [user, setUser] = React.useState<any>(null);
    const [notifications, setNotifications] = React.useState<any[]>([]);
    const [newCount, setNewCount] = React.useState<number>(0);
    // Push notification polling
    const [pendingCount, setPendingCount] = React.useState<number>(0);
    const [newPendingBadge, setNewPendingBadge] = React.useState<number>(0);
    const knownIds = React.useRef<Set<number>>(new Set());
    const isFirstLoad = React.useRef(true);

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

    // Polling for new pending orders
    React.useEffect(() => {
        const checkOrders = async () => {
            try {
                const { getPendingOrdersForPolling } = await import('@/app/actions/orders');
                const pendingOrders = await getPendingOrdersForPolling();
                const ids = pendingOrders.map((o: any) => o.id);
                setPendingCount(ids.length);

                if (isFirstLoad.current) {
                    // On first load, just register existing IDs
                    ids.forEach((id: number) => knownIds.current.add(id));
                    isFirstLoad.current = false;
                    return;
                }

                const newOrders = ids.filter((id: number) => !knownIds.current.has(id));
                if (newOrders.length > 0) {
                    newOrders.forEach((id: number) => knownIds.current.add(id));
                    setNewPendingBadge(prev => prev + newOrders.length);
                    playNotificationBeep();
                }

                // Remove fulfilled orders from known set
                const currentSet = new Set(ids);
                knownIds.current.forEach(id => {
                    if (!currentSet.has(id)) knownIds.current.delete(id);
                });
            } catch (_) { /* ignore polling errors silently */ }
        };

        checkOrders();
        const interval = setInterval(checkOrders, 15000); // every 15s
        return () => clearInterval(interval);
    }, []);

    const handleBellClick = () => {
        setNewPendingBadge(0);
    };

    const totalBadge = newPendingBadge + newCount;

    const getIcon = (iconType: string) => {
        switch (iconType) {
            case 'truck': return Truck;
            case 'utensils': return UtensilsCrossed;
            case 'creditcard': return CreditCard;
            case 'cancel': return X;
            default: return Bell;
        }
    };

    return (
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                    <LayoutDashboard className="size-6" />
                </button>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="hidden lg:flex p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                    <LayoutDashboard className="size-6" />
                </button>
            </div>

            <div className="flex items-center gap-4">
                {/* Pending orders indicator */}
                {pendingCount > 0 && (
                    <a href="/dashboard/expedition" className="hidden sm:flex items-center gap-2 text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-all text-xs font-bold">
                        <ShoppingBag className="size-4" />
                        {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                    </a>
                )}

                {/* Notification Bell */}
                <div className="relative group">
                    <button
                        className="p-2 text-slate-400 hover:text-slate-600 relative"
                        onClick={handleBellClick}
                    >
                        <Bell className="size-5" />
                        {totalBadge > 0 && (
                            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white">
                                {totalBadge > 9 ? '9+' : totalBadge}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Notificações</h3>
                            {totalBadge > 0 ? (
                                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{totalBadge} Novas</span>
                            ) : (
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Nenhuma</span>
                            )}
                        </div>
                        <div className="max-h-[320px] overflow-y-auto">
                            {newPendingBadge > 0 && (
                                <div className="p-4 hover:bg-amber-50 border-b border-slate-50 cursor-pointer transition-colors">
                                    <div className="flex gap-3">
                                        <div className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-100 text-amber-600">
                                            <ShoppingBag className="size-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900">
                                                {newPendingBadge} novo{newPendingBadge !== 1 ? 's' : ''} pedido{newPendingBadge !== 1 ? 's' : ''}!
                                            </p>
                                            <p className="text-xs text-slate-500">Acesse a Expedição para aceitar</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {notifications.length > 0 ? (
                                notifications.map((notif, i) => {
                                    const Icon = getIcon(notif.iconType);
                                    return (
                                        <div key={i} className="p-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 cursor-pointer transition-colors">
                                            <div className="flex gap-3">
                                                <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", notif.color)}>
                                                    <Icon className="size-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900 truncate">{notif.title}</p>
                                                    <p className="text-xs text-slate-500 truncate">{notif.desc}</p>
                                                    <p className="text-[10px] text-slate-400 mt-1">{notif.time}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : newPendingBadge === 0 ? (
                                <div className="p-4 text-center text-slate-500 text-sm">
                                    Nenhuma notificação recente.
                                </div>
                            ) : null}
                        </div>
                        <div className="p-3 text-center border-t border-slate-100">
                            <a href="/dashboard/expedition" className="text-xs font-bold text-primary hover:underline">Ver todos os pedidos</a>
                        </div>
                    </div>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
                <button className="hidden sm:flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium text-sm">
                    <span>{user?.nome || 'Minha Loja'}</span>
                    <ChevronDown className="size-4" />
                </button>
            </div>
        </header>
    );
}
