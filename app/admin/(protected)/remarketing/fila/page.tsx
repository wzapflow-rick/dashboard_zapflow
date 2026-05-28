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
  Play,
  Pause,
  Trash2,
  Filter,
} from 'lucide-react';
import { 
  getFila, 
  cancelarFilaItem,
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
    await cancelarFilaItem(item.id);
    loadFila(pagination.page);
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

  const stats = {
    pendente: fila.filter(f => f.status === 'pendente').length,
    enviado: fila.filter(f => f.status === 'enviado').length,
    erro: fila.filter(f => f.status === 'erro').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Fila de Disparos</h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            {pagination.total} itens na fila
          </p>
        </div>
        <button
          onClick={() => loadFila(1)}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-[#162438] hover:bg-[#1e3a5f] text-white px-4 py-2.5 rounded-lg font-medium transition-all w-full sm:w-auto"
        >
          <RefreshCw className={cn("size-5", loading && "animate-spin")} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Clock className="size-6 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-yellow-400">{stats.pendente}</p>
              <p className="text-sm text-slate-400">Pendentes</p>
            </div>
          </div>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-6 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-green-400">{stats.enviado}</p>
              <p className="text-sm text-slate-400">Enviados</p>
            </div>
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <XCircle className="size-6 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-red-400">{stats.erro}</p>
              <p className="text-sm text-slate-400">Erros</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="size-5 text-slate-500" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0f1f35] border border-[#1e3a5f] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500"
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
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : fila.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <ListTodo className="size-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum item na fila</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e3a5f]/50">
            {fila.map((item) => {
              const statusConfig = getStatusConfig(item.status);
              const StatusIcon = statusConfig.icon;
              return (
                <div key={item.id} className="p-4 hover:bg-[#162438]/50">
                  <div className="flex items-start gap-4">
                    {/* Status Icon */}
                    <div className={cn(
                      "p-2 rounded-lg",
                      statusConfig.color === 'yellow' && "bg-yellow-500/10",
                      statusConfig.color === 'blue' && "bg-blue-500/10",
                      statusConfig.color === 'green' && "bg-green-500/10",
                      statusConfig.color === 'red' && "bg-red-500/10",
                      statusConfig.color === 'slate' && "bg-slate-500/10",
                    )}>
                      <StatusIcon className={cn(
                        "size-5",
                        statusConfig.color === 'yellow' && "text-yellow-400",
                        statusConfig.color === 'blue' && "text-blue-400 animate-spin",
                        statusConfig.color === 'green' && "text-green-400",
                        statusConfig.color === 'red' && "text-red-400",
                        statusConfig.color === 'slate' && "text-slate-400",
                      )} />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">
                          {item.contato_nome || item.contato_telefone}
                        </p>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs",
                          statusConfig.color === 'yellow' && "bg-yellow-500/10 text-yellow-400",
                          statusConfig.color === 'blue' && "bg-blue-500/10 text-blue-400",
                          statusConfig.color === 'green' && "bg-green-500/10 text-green-400",
                          statusConfig.color === 'red' && "bg-red-500/10 text-red-400",
                          statusConfig.color === 'slate' && "bg-slate-500/10 text-slate-400",
                        )}>
                          {statusConfig.label}
                        </span>
                        {item.categoria_nome && (
                          <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400">
                            {item.categoria_nome}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400">
                          P{item.prioridade}
                        </span>
                      </div>
                      
                      <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                        {item.conteudo_final}
                      </p>
                      
                      {item.erro && (
                        <p className="text-sm text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          {item.erro}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
                        <span>Agendado: {formatDate(item.agendado_para)}</span>
                        {item.enviado_em && <span>Enviado: {formatDate(item.enviado_em)}</span>}
                        <span>Tentativas: {item.tentativas}/{item.max_tentativas}</span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    {item.status === 'pendente' && (
                      <button
                        onClick={() => handleCancelar(item)}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                        title="Cancelar"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginacao */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#1e3a5f] flex items-center justify-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadFila(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-slate-300 text-sm">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => loadFila(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
