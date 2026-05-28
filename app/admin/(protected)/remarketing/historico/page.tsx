'use client';

import { useEffect, useState } from 'react';
import { 
  History, 
  RefreshCw, 
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Tag,
  Target,
  Send,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { 
  getHistorico,
  type RemarketingHistorico,
} from '@/app/actions/remarketing';
import { cn } from '@/lib/utils';

const TIPO_CONFIG: Record<string, { label: string; color: string; icon: typeof MessageSquare }> = {
  msg_enviada: { label: 'Mensagem Enviada', color: 'green', icon: Send },
  msg_recebida: { label: 'Mensagem Recebida', color: 'blue', icon: MessageSquare },
  msg_erro: { label: 'Erro no Envio', color: 'red', icon: AlertCircle },
  etiqueta_add: { label: 'Etiqueta Adicionada', color: 'purple', icon: Tag },
  etiqueta_remove: { label: 'Etiqueta Removida', color: 'orange', icon: Tag },
  categoria_add: { label: 'Categoria Adicionada', color: 'cyan', icon: Target },
  categoria_remove: { label: 'Categoria Removida', color: 'yellow', icon: Target },
  contato_importado: { label: 'Contato Importado', color: 'emerald', icon: MessageSquare },
  contato_bloqueado: { label: 'Contato Bloqueado', color: 'red', icon: AlertCircle },
};

export default function HistoricoPage() {
  const [historico, setHistorico] = useState<RemarketingHistorico[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState<string>('');

  useEffect(() => {
    loadHistorico(1);
  }, []);

  const loadHistorico = async (page: number) => {
    setLoading(true);
    const result = await getHistorico(page, 50);
    if (result.success) {
      setHistorico(result.historico || []);
      setPagination(result.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    }
    setLoading(false);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTipoConfig = (tipo: string) => {
    return TIPO_CONFIG[tipo] || { label: tipo, color: 'slate', icon: MessageSquare };
  };

  const filteredHistorico = tipoFilter 
    ? historico.filter(h => h.tipo === tipoFilter)
    : historico;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Historico</h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            Registro de todas as acoes do remarketing
          </p>
        </div>
        <button
          onClick={() => loadHistorico(1)}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-[#162438] hover:bg-[#1e3a5f] text-white px-4 py-2.5 rounded-lg font-medium transition-all w-full sm:w-auto"
        >
          <RefreshCw className={cn("size-5", loading && "animate-spin")} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="size-5 text-slate-500" />
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="bg-[#0f1f35] border border-[#1e3a5f] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : filteredHistorico.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <History className="size-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum registro encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e3a5f]/50">
            {filteredHistorico.map((item) => {
              const tipoConfig = getTipoConfig(item.tipo);
              const TipoIcon = tipoConfig.icon;
              return (
                <div key={item.id} className="p-4 hover:bg-[#162438]/50">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={cn(
                      "p-2 rounded-lg",
                      tipoConfig.color === 'green' && "bg-green-500/10",
                      tipoConfig.color === 'blue' && "bg-blue-500/10",
                      tipoConfig.color === 'red' && "bg-red-500/10",
                      tipoConfig.color === 'purple' && "bg-purple-500/10",
                      tipoConfig.color === 'orange' && "bg-orange-500/10",
                      tipoConfig.color === 'cyan' && "bg-cyan-500/10",
                      tipoConfig.color === 'yellow' && "bg-yellow-500/10",
                      tipoConfig.color === 'emerald' && "bg-emerald-500/10",
                      tipoConfig.color === 'slate' && "bg-slate-500/10",
                    )}>
                      <TipoIcon className={cn(
                        "size-5",
                        tipoConfig.color === 'green' && "text-green-400",
                        tipoConfig.color === 'blue' && "text-blue-400",
                        tipoConfig.color === 'red' && "text-red-400",
                        tipoConfig.color === 'purple' && "text-purple-400",
                        tipoConfig.color === 'orange' && "text-orange-400",
                        tipoConfig.color === 'cyan' && "text-cyan-400",
                        tipoConfig.color === 'yellow' && "text-yellow-400",
                        tipoConfig.color === 'emerald' && "text-emerald-400",
                        tipoConfig.color === 'slate' && "text-slate-400",
                      )} />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs",
                          tipoConfig.color === 'green' && "bg-green-500/10 text-green-400",
                          tipoConfig.color === 'blue' && "bg-blue-500/10 text-blue-400",
                          tipoConfig.color === 'red' && "bg-red-500/10 text-red-400",
                          tipoConfig.color === 'purple' && "bg-purple-500/10 text-purple-400",
                          tipoConfig.color === 'orange' && "bg-orange-500/10 text-orange-400",
                          tipoConfig.color === 'cyan' && "bg-cyan-500/10 text-cyan-400",
                          tipoConfig.color === 'yellow' && "bg-yellow-500/10 text-yellow-400",
                          tipoConfig.color === 'emerald' && "bg-emerald-500/10 text-emerald-400",
                          tipoConfig.color === 'slate' && "bg-slate-500/10 text-slate-400",
                        )}>
                          {tipoConfig.label}
                        </span>
                        {item.contato_nome && (
                          <span className="text-white font-medium">
                            {item.contato_nome}
                          </span>
                        )}
                        {item.contato_telefone && !item.contato_nome && (
                          <span className="text-white">
                            {item.contato_telefone}
                          </span>
                        )}
                      </div>
                      
                      {item.descricao && (
                        <p className="text-sm text-slate-400 mt-1">
                          {item.descricao}
                        </p>
                      )}
                      
                      <p className="text-xs text-slate-500 mt-2">
                        {formatDate(item.created_at)}
                      </p>
                    </div>
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
                onClick={() => loadHistorico(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-slate-300 text-sm">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => loadHistorico(pagination.page + 1)}
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
