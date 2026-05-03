'use client';

import { useEffect, useState } from 'react';
import { getEmpresas, createEmpresa, updateEmpresa, concederTrialGratuito, deleteEmpresa } from '@/app/actions/admin';
import { 
  Building2, Search, Plus, Edit2, Gift, ExternalLink, 
  ChevronLeft, ChevronRight, X, Check, AlertCircle, Trash2
} from 'lucide-react';

interface Empresa {
  id: number;
  nome: string;
  nome_fantasia: string;
  razao_social?: string;
  slug: string;
  url_slug?: string;
  email: string;
  telefone: string;
  whatsapp?: string;
  status: string;
  plano: string;
  assinatura_plano?: string;
  assinatura_status: string;
  data_proxima_cobranca: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function EmpresasAdminPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadEmpresas(1);
  }, []);

  const loadEmpresas = async (page: number, searchTerm = search) => {
    setLoading(true);
    const result = await getEmpresas(page, 20, searchTerm);
    if (result.success) {
      setEmpresas(result.empresas || []);
      setPagination(result.pagination || null);
    }
    setLoading(false);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      loadEmpresas(1, value);
    }, 500);
    setSearchTimeout(timeout);
  };

  const openEditModal = (empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    setShowEditModal(true);
  };

  const openTrialModal = (empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    setShowTrialModal(true);
  };

  const openDeleteConfirm = (empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!selectedEmpresa) return;
    setDeleting(true);
    const result = await deleteEmpresa(selectedEmpresa.id);
    if (result.success) {
      setShowDeleteConfirm(false);
      setSelectedEmpresa(null);
      loadEmpresas(pagination?.page || 1);
    }
    setDeleting(false);
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string, dataVencimento: string) => {
    if (status !== 'authorized') {
      return <span className="px-2 py-1 rounded-full text-xs bg-red-500/10 text-red-400">Inativo</span>;
    }
    
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    
    if (vencimento < hoje) {
      return <span className="px-2 py-1 rounded-full text-xs bg-red-500/10 text-red-400">Vencido</span>;
    }
    
    const diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diasRestantes <= 7) {
      return <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/10 text-yellow-400">Vence em {diasRestantes}d</span>;
    }
    
    return <span className="px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-400">Ativo</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Empresas</h1>
          <p className="text-slate-400 mt-1">Gerencie todas as empresas do sistema</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-all"
        >
          <Plus className="size-5" />
          Nova Empresa
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nome, slug ou email..."
          className="w-full bg-[#0f1f35] border border-[#1e3a5f] rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Tabela */}
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0a1628]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Empresa</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Slug</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Plano</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Vencimento</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                  </td>
                </tr>
              ) : empresas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Nenhuma empresa encontrada
                  </td>
                </tr>
              ) : (
                empresas.map((empresa) => (
                  <tr key={empresa.id} className="hover:bg-[#162438]/50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-white">{empresa.nome_fantasia || empresa.nome}</p>
                        <p className="text-sm text-slate-400">{empresa.email || '-'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300">{empresa.slug}</span>
                    </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400 uppercase">
                          {empresa.assinatura_plano || empresa.plano || 'Sem plano'}
                        </span>
                      </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(empresa.assinatura_status, empresa.data_proxima_cobranca)}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {formatDate(empresa.data_proxima_cobranca)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(empresa)}
                          className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="size-4" />
                        </button>
                        <button
                          onClick={() => openTrialModal(empresa)}
                          className="p-2 hover:bg-green-500/10 rounded-lg text-slate-400 hover:text-green-400 transition-colors"
                          title="Conceder Trial"
                        >
                          <Gift className="size-4" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(empresa)}
                          className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                          title="Excluir Empresa"
                        >
                          <Trash2 className="size-4" />
                        </button>
                        <a
                          href={`/menu/${empresa.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white transition-colors"
                          title="Ver Cardapio"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginacao */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#1e3a5f] flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Mostrando {empresas.length} de {pagination.total} empresas
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadEmpresas(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-slate-300">
                Pagina {pagination.page} de {pagination.totalPages}
              </span>
              <button
                onClick={() => loadEmpresas(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Criar Empresa */}
      {showCreateModal && (
        <CreateEmpresaModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadEmpresas(1);
          }}
        />
      )}

      {/* Modal Editar Empresa */}
      {showEditModal && selectedEmpresa && (
        <EditEmpresaModal
          empresa={selectedEmpresa}
          onClose={() => {
            setShowEditModal(false);
            setSelectedEmpresa(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedEmpresa(null);
            loadEmpresas(pagination?.page || 1);
          }}
        />
      )}

      {/* Modal Conceder Trial */}
      {showTrialModal && selectedEmpresa && (
        <TrialModal
          empresa={selectedEmpresa}
          onClose={() => {
            setShowTrialModal(false);
            setSelectedEmpresa(null);
          }}
          onSuccess={() => {
            setShowTrialModal(false);
            setSelectedEmpresa(null);
            loadEmpresas(pagination?.page || 1);
          }}
        />
      )}

      {/* Modal Confirmar Exclusao */}
      {showDeleteConfirm && selectedEmpresa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-md">
            <div className="p-6 text-center">
              <div className="size-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="size-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Excluir Empresa?</h2>
              <p className="text-slate-400 mb-6">
                Tem certeza que deseja excluir <strong className="text-white">{selectedEmpresa.nome_fantasia || selectedEmpresa.nome}</strong>? 
                Esta acao ira remover todos os dados da empresa, incluindo assinaturas e usuarios.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedEmpresa(null);
                  }}
                  className="flex-1 px-4 py-3 border border-[#1e3a5f] rounded-lg text-slate-300 hover:bg-[#1e3a5f] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
                >
                  {deleting ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal Criar Empresa
function CreateEmpresaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    nome_fantasia: '',
    slug: '',
    email: '',
    telefone: '',
    plano: 'start',
    dias_trial: 30,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await createEmpresa(formData);
    
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Erro ao criar empresa');
    }
    setLoading(false);
  };

  const generateSlug = (nome: string) => {
    return nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
          <h2 className="text-xl font-bold text-white">Nova Empresa</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="size-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="size-4" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nome da Empresa *</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  nome: e.target.value,
                  slug: generateSlug(e.target.value),
                });
              }}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nome Fantasia</label>
            <input
              type="text"
              value={formData.nome_fantasia}
              onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Slug (URL) *</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              required
            />
            <p className="text-xs text-slate-500 mt-1">cardapio.wzapflow.com.br/menu/{formData.slug}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Telefone</label>
              <input
                type="text"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

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
              <label className="block text-sm font-medium text-slate-300 mb-2">Dias de Acesso</label>
              <input
                type="number"
                value={formData.dias_trial}
                onChange={(e) => setFormData({ ...formData, dias_trial: parseInt(e.target.value) })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                min="1"
              />
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
              {loading ? 'Criando...' : 'Criar Empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal Editar Empresa
function EditEmpresaModal({ empresa, onClose, onSuccess }: { empresa: Empresa; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Usa nome_fantasia como fallback principal ja que alguns registros nao tem campo 'nome'
  const [formData, setFormData] = useState({
    nome: empresa.nome_fantasia || empresa.nome || '',
    nome_fantasia: empresa.nome_fantasia || '',
    slug: empresa.slug || '',
    email: empresa.email || '',
    telefone: empresa.telefone || empresa.whatsapp || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await updateEmpresa(empresa.id, formData);
    
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Erro ao atualizar empresa');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
          <h2 className="text-xl font-bold text-white">Editar Empresa</h2>
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

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nome</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nome Fantasia</label>
            <input
              type="text"
              value={formData.nome_fantasia}
              onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Slug</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Telefone</label>
              <input
                type="text"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
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

// Modal Conceder Trial
function TrialModal({ empresa, onClose, onSuccess }: { empresa: Empresa; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [dias, setDias] = useState(30);
  const [plano, setPlano] = useState(empresa.assinatura_plano || empresa.plano || 'start');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await concederTrialGratuito(empresa.id, dias, plano);
    
    if (result.success) {
      onSuccess();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
          <h2 className="text-xl font-bold text-white">Conceder Acesso Gratuito</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="size-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Gift className="size-6 text-green-400" />
              <div>
                <p className="text-white font-medium">{empresa.nome_fantasia || empresa.nome}</p>
                <p className="text-sm text-slate-400">Conceder acesso gratuito</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Plano</label>
            <select
              value={plano}
              onChange={(e) => setPlano(e.target.value)}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            >
              <option value="start">Start</option>
              <option value="pro">Pro</option>
              <option value="elite">Elite</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Dias de Acesso</label>
            <input
              type="number"
              value={dias}
              onChange={(e) => setDias(parseInt(e.target.value))}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              min="1"
            />
            <p className="text-xs text-slate-500 mt-1">
              Vencimento: {new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}
            </p>
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
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
            >
              {loading ? 'Concedendo...' : 'Conceder Acesso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
