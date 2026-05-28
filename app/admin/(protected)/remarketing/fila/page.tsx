'use client';

import { useEffect, useState } from 'react';
import { 
  ListTodo, 
  RefreshCw, 
  X,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Zap,
  Loader2,
  Send,
  Filter,
  Trash2,
} from 'lucide-react';
import { 
  getFila, 
  cancelarFilaItem,
  processarFilaItem,
  type RemarketingFilaItem,
} from '@/app/actions/remarketing';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: 'yellow', icon: Clock },
  enviando: { label: 'Enviando', color: 'blue', icon: RefreshCw },
  enviado: { label: 'Enviado', color: 'green', icon: CheckCircle2 },
  erro: { label: 'Erro', color: 'red', icon: XCircle },
  cancelado: { label: 'Cancelado', color: 'slate', icon: X },
};

export default function FilaPage() {
  const [fila, setFila] = useState<RemarketingFilaItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const [processingAll, setProcessingAll] = useState(false);

  const setActionLoading = (key: string, isLoading: boolean) => {
    setLoadingActions(prev => {
      const next = new Set(prev);
      if (isLoading) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  useEffect(() => {
    loadFila(1);
  }, [statusFilter]);

  const loadFila = async (page: number) => {
    setLoading(true);
    const result = await getFila(page, 50, statusFilter || undefined);
    if (result.success) {
      setFila(result.fila || []);
      setPagination(result.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    }
    setLoading(false);
  };

  const handleCancelar = async (item: RemarketingFilaItem) => {
    if (!confirm('Cancelar este disparo?')) return;
    const key = `cancel-${item.id}`;
    setActionLoading(key, true);
    await cancelarFilaItem(item.id);
    await loadFila(pagination.page);
    setActionLoading(key, false);
  };

  const handleEnviarAgora = async (item: RemarketingFilaItem) => {
    if (!confirm('Enviar esta mensagem agora (ignorando tempo de espera)?')) return;
    const key = `send-${item.id}`;
    setActionLoading(key, true);
    const result = await processarFilaItem(item.id);
    if (!result.success) {
      alert(result.error || 'Erro ao enviar mensagem');
    }
    await loadFila(pagination.page);
    setActionLoading(key, false);
  };

  const handleProcessarTodos = async () => {
    const pendentes = fila.filter(f => f.status === 'pendente');
    if (pendentes.length === 0) {
      alert('Nenhum item pendente na fila');
      return;
    }
    if (!confirm(`Enviar ${pendentes.length} mensagens agora (ignorando tempo de espera)?`)) return;
    
    setProcessingAll(true);
    for (const item of pendentes) {
      await processarFilaItem(item.id);
    }
    await loadFila(1);
    setProcessingAll(false);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pendente;
  };

  const getStatusClasses = (color: string) => {
    const classes: Record<string, { bg: string; text: string; border: string }> = {
      yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
      blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
      green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
      red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
      slate: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
    };
    return classes[color] || classes.slate;
  };

  const stats = {
    pendente: fila.filter(f => f.status === 'pendente').length,
    enviado: fila.filter(f => f.status === 'enviado').length,
    erro: fila.filter(f => f.status === 'erro').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Fila de Disparos</h1>
          <p className="text-slate-400 mt-1">
            {pagination.total} itens na fila
          </p>
        </div>
        <div className="flex gap-2">
          {stats.pendente > 0 && (
            <button
              onClick={handleProcessarTodos}
              disabled={processingAll}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
            >
              {processingAll ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              <span>{processingAll ? 'Processando...' : `Enviar ${stats.pendente} Agora`}</span>
            </button>
          )}
          <button
            onClick={() => loadFila(1)}
            disabled={loading}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#0f1f35] border border-yellow-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-xl">
              <Clock className="size-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-yellow-400">{stats.pendente}</p>
              <p className="text-sm text-slate-400">Pendentes</p>
            </div>
          </div>
        </div>
        <div className="bg-[#0f1f35] border border-green-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <CheckCircle2 className="size-6 text-green-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-green-400">{stats.enviado}</p>
              <p className="text-sm text-slate-400">Enviados</p>
            </div>
          </div>
        </div>
        <div className="bg-[#0f1f35] border border-red-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-xl">
              <XCircle className="size-6 text-red-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-red-400">{stats.erro}</p>
              <p className="text-sm text-slate-400">Erros</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="size-5 text-slate-500" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="enviando">Enviando</option>
          <option value="enviado">Enviado</option>
          <option value="erro">Erro</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* Lista */}
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-orange-500" />
          </div>
        ) : fila.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-[#1e3a5f] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ListTodo className="size-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-white mb-2">Nenhum item na fila</p>
            <p className="text-slate-400">Os disparos agendados aparecerao aqui</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e3a5f]/50">
            {fila.map((item) => {
              const statusConfig = getStatusConfig(item.status);
              const statusClasses = getStatusClasses(statusConfig.color);
              const StatusIcon = statusConfig.icon;
              const isSending = loadingActions.has(`send-${item.id}`);
              const isCanceling = loadingActions.has(`cancel-${item.id}`);
              
              return (
                <div key={item.id} className="p-5 hover:bg-[#162438]/50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Status Icon */}
                    <div className={cn("p-3 rounded-xl", statusClasses.bg)}>
                      <StatusIcon className={cn(
                        "size-5",
                        statusClasses.text,
                        statusConfig.color === 'blue' && "animate-spin"
                      )} />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white">
                          {item.contato_nome || item.contato_telefone}
                        </p>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-lg text-xs font-medium",
                          statusClasses.bg, statusClasses.text
                        )}>
                          {statusConfig.label}
                        </span>
                        {item.categoria_nome && (
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400">
                            {item.categoria_nome}
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400">
                          P{item.prioridade}
                        </span>
                      </div>
                      
                      <p className="text-sm text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                        {item.conteudo_final}
                      </p>
                      
                      {item.erro && (
                        <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-sm text-red-400 flex items-center gap-1.5">
                            <AlertCircle className="size-3.5 flex-shrink-0" />
                            {item.erro}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-3" />
                          Agendado: {formatDate(item.agendado_para)}
                        </span>
                        {item.enviado_em && (
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="size-3" />
                            Enviado: {formatDate(item.enviado_em)}
                          </span>
                        )}
                        <span>Tentativas: {item.tentativas}/{item.max_tentativas}</span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    {item.status === 'pendente' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEnviarAgora(item)}
                          disabled={isSending || isCanceling}
                          className="p-2.5 hover:bg-green-500/10 rounded-xl text-slate-400 hover:text-green-400 transition-colors disabled:opacity-50"
                          title="Enviar agora"
                        >
                          {isSending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Send className="size-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleCancelar(item)}
                          disabled={isSending || isCanceling}
                          className="p-2.5 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Cancelar"
                        >
                          {isCanceling ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <X className="size-4" />
                          )}
                        </button>
                      </div>
                    )}
                    {item.status === 'erro' && (
                      <button
                        onClick={() => handleEnviarAgora(item)}
                        disabled={isSending}
                        className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        title="Tentar novamente"
                      >
                        {isSending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                        <span>Reenviar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#1e3a5f] flex items-center justify-center bg-[#0a1628]/50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadFila(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="p-2.5 hover:bg-[#1e3a5f] rounded-xl text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-slate-300 text-sm px-3">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => loadFila(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="p-2.5 hover:bg-[#1e3a5f] rounded-xl text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
