'use client';

import { useEffect, useState } from 'react';
import { getAssinaturas, updateAssinatura } from '@/app/actions/admin';
import { 
  CreditCard, Search, Edit2, Calendar, 
  ChevronLeft, ChevronRight, X, CheckCircle, XCircle, Clock
} from 'lucide-react';

interface Assinatura {
  id: number;
  empresa_id: number;
  empresa_nome: string;
  nome_fantasia: string;
  slug: string;
  email: string;
  plano: string;
  status: string;
  valor: number;
  data_inicio: string;
  data_proxima_cobranca: string;
  cartao_ultimos_digitos: string;
  cartao_bandeira: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AssinaturasAdminPage() {
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAssinatura, setSelectedAssinatura] = useState<Assinatura | null>(null);

  useEffect(() => {
    loadAssinaturas(1);
  }, []);

  const loadAssinaturas = async (page: number, searchTerm = search) => {
    setLoading(true);
    const result = await getAssinaturas(page, 20, searchTerm);
    if (result.success) {
      setAssinaturas(result.assinaturas || []);
      setPagination(result.pagination || null);
    }
    setLoading(false);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      loadAssinaturas(1, value);
    }, 500);
    setSearchTimeout(timeout);
  };

  const openEditModal = (assinatura: Assinatura) => {
    setSelectedAssinatura(assinatura);
    setShowEditModal(true);
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const getStatusIcon = (status: string, dataVencimento: string) => {
    if (status !== 'authorized') {
      return <XCircle className="size-5 text-red-400" />;
    }
    
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    
    if (vencimento < hoje) {
      return <XCircle className="size-5 text-red-400" />;
    }
    
    const diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diasRestantes <= 7) {
      return <Clock className="size-5 text-yellow-400" />;
    }
    
    return <CheckCircle className="size-5 text-green-400" />;
  };

  const getStatusLabel = (status: string, dataVencimento: string) => {
    if (status !== 'authorized') {
      return { text: 'Cancelada', color: 'bg-red-500/10 text-red-400' };
    }
    
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    
    if (vencimento < hoje) {
      return { text: 'Vencida', color: 'bg-red-500/10 text-red-400' };
    }
    
    const diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diasRestantes <= 7) {
      return { text: `Vence em ${diasRestantes}d`, color: 'bg-yellow-500/10 text-yellow-400' };
    }
    
    return { text: 'Ativa', color: 'bg-green-500/10 text-green-400' };
  };

  const getPlanoBadge = (plano: string) => {
    const colors: Record<string, string> = {
      start: 'bg-blue-500/10 text-blue-400',
      pro: 'bg-orange-500/10 text-orange-400',
      elite: 'bg-purple-500/10 text-purple-400',
    };
    return colors[plano] || 'bg-slate-500/10 text-slate-400';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Assinaturas</h1>
        <p className="text-slate-400 mt-1 text-sm sm:text-base">Gerencie planos e datas de vencimento</p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por empresa..."
          className="w-full bg-[#0f1f35] border border-[#1e3a5f] rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Cards Mobile */}
      <div className="lg:hidden space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : assinaturas.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-[#0f1f35] border border-[#1e3a5f] rounded-xl">
            Nenhuma assinatura encontrada
          </div>
        ) : (
          assinaturas.map((assinatura) => {
            const statusInfo = getStatusLabel(assinatura.status, assinatura.data_proxima_cobranca);
            return (
              <div key={assinatura.id} className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-white">{assinatura.nome_fantasia || assinatura.empresa_nome}</p>
                    <p className="text-sm text-slate-400">{assinatura.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(assinatura.status, assinatura.data_proxima_cobranca)}
                    <span className={`px-2 py-1 rounded-full text-xs ${statusInfo.color}`}>
                      {statusInfo.text}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs uppercase ${getPlanoBadge(assinatura.plano)}`}>
                    {assinatura.plano || 'Sem plano'}
                  </span>
                  <span className="text-slate-300">{formatCurrency(assinatura.valor)}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-[#1e3a5f]/50">
                  <div className="text-slate-400">
                    <span>Vence: {formatDate(assinatura.data_proxima_cobranca)}</span>
                  </div>
                  <button
                    onClick={() => openEditModal(assinatura)}
                    className="flex items-center gap-2 px-3 py-2 bg-[#162438] rounded-lg text-slate-300 hover:text-white transition-colors"
                  >
                    <Edit2 className="size-4" />
                    <span>Editar</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tabela Desktop */}
      <div className="hidden lg:block bg-[#0f1f35] border border-[#1e3a5f] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0a1628]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Empresa</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Plano</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Valor</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Vencimento</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Pagamento</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                  </td>
                </tr>
              ) : assinaturas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Nenhuma assinatura encontrada
                  </td>
                </tr>
              ) : (
                assinaturas.map((assinatura) => {
                  const statusInfo = getStatusLabel(assinatura.status, assinatura.data_proxima_cobranca);
                  return (
                    <tr key={assinatura.id} className="hover:bg-[#162438]/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(assinatura.status, assinatura.data_proxima_cobranca)}
                          <span className={`px-2 py-1 rounded-full text-xs ${statusInfo.color}`}>
                            {statusInfo.text}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">{assinatura.nome_fantasia || assinatura.empresa_nome}</p>
                          <p className="text-sm text-slate-400">{assinatura.slug}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs uppercase ${getPlanoBadge(assinatura.plano)}`}>
                          {assinatura.plano || 'Sem plano'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {formatCurrency(assinatura.valor)}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {formatDate(assinatura.data_proxima_cobranca)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-400 text-sm">
                          {assinatura.cartao_bandeira || '-'} 
                          {assinatura.cartao_ultimos_digitos && ` ****${assinatura.cartao_ultimos_digitos}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => openEditModal(assinatura)}
                          className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginacao */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#1e3a5f] flex items-center justify-between">
            <p className="text-sm text-slate-400 hidden sm:block">
              Mostrando {assinaturas.length} de {pagination.total} assinaturas
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
              <button
                onClick={() => loadAssinaturas(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-slate-300 text-sm">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => loadAssinaturas(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paginacao Mobile */}
      {pagination && pagination.totalPages > 1 && (
        <div className="lg:hidden flex items-center justify-center gap-4 py-4">
          <button
            onClick={() => loadAssinaturas(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-2 bg-[#0f1f35] border border-[#1e3a5f] rounded-lg text-slate-400 hover:text-white disabled:opacity-50"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="text-slate-300 text-sm">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => loadAssinaturas(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-2 bg-[#0f1f35] border border-[#1e3a5f] rounded-lg text-slate-400 hover:text-white disabled:opacity-50"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}

      {/* Modal Editar Assinatura */}
      {showEditModal && selectedAssinatura && (
        <EditAssinaturaModal
          assinatura={selectedAssinatura}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAssinatura(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedAssinatura(null);
            loadAssinaturas(pagination?.page || 1);
          }}
        />
      )}
    </div>
  );
}

// Modal Editar Assinatura
function EditAssinaturaModal({ 
  assinatura, 
  onClose, 
  onSuccess 
}: { 
  assinatura: Assinatura; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    plano: assinatura.plano || 'start',
    status: assinatura.status || 'authorized',
    data_proxima_cobranca: assinatura.data_proxima_cobranca 
      ? new Date(assinatura.data_proxima_cobranca).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    valor: assinatura.valor || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await updateAssinatura(assinatura.empresa_id, {
      ...formData,
      data_proxima_cobranca: new Date(formData.data_proxima_cobranca).toISOString(),
    });
    
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Erro ao atualizar assinatura');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
          <div>
            <h2 className="text-xl font-bold text-white">Editar Assinatura</h2>
            <p className="text-sm text-slate-400 mt-1">{assinatura.nome_fantasia || assinatura.empresa_nome}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="size-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Plano</label>
              <select
                value={formData.plano}
                onChange={(e) => setFormData({ ...formData, plano: e.target.value })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="start">Start</option>
                <option value="pro">Pro</option>
                <option value="elite">Elite</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="authorized">Ativa</option>
                <option value="pending">Pendente</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Calendar className="inline size-4 mr-1" />
              Data de Vencimento
            </label>
            <input
              type="date"
              value={formData.data_proxima_cobranca}
              onChange={(e) => setFormData({ ...formData, data_proxima_cobranca: e.target.value })}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) })}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Atalhos */}
          <div className="bg-[#0a1628] rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-3">Atalhos rapidos:</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() + 7);
                  setFormData({ ...formData, data_proxima_cobranca: date.toISOString().split('T')[0] });
                }}
                className="px-3 py-1 bg-[#1e3a5f] hover:bg-[#2a4a6f] rounded text-sm text-slate-300 transition-colors"
              >
                +7 dias
              </button>
              <button
                type="button"
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() + 30);
                  setFormData({ ...formData, data_proxima_cobranca: date.toISOString().split('T')[0] });
                }}
                className="px-3 py-1 bg-[#1e3a5f] hover:bg-[#2a4a6f] rounded text-sm text-slate-300 transition-colors"
              >
                +30 dias
              </button>
              <button
                type="button"
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() + 90);
                  setFormData({ ...formData, data_proxima_cobranca: date.toISOString().split('T')[0] });
                }}
                className="px-3 py-1 bg-[#1e3a5f] hover:bg-[#2a4a6f] rounded text-sm text-slate-300 transition-colors"
              >
                +90 dias
              </button>
              <button
                type="button"
                onClick={() => {
                  const date = new Date();
                  date.setFullYear(date.getFullYear() + 1);
                  setFormData({ ...formData, data_proxima_cobranca: date.toISOString().split('T')[0] });
                }}
                className="px-3 py-1 bg-[#1e3a5f] hover:bg-[#2a4a6f] rounded text-sm text-slate-300 transition-colors"
              >
                +1 ano
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-[#1e3a5f] rounded-lg text-slate-300 hover:bg-[#1e3a5f] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
