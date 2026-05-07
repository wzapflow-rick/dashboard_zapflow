'use client';

import { useEffect, useState } from 'react';
import { 
  listarCuponsPlataforma, 
  criarCupomPlataforma, 
  atualizarCupomPlataforma,
  excluirCupomPlataforma,
  toggleCupomPlataforma,
  type CupomPlataforma 
} from '@/app/actions/cupons-plataforma';
import { 
  Ticket, Plus, Search, Edit2, Trash2, Power, X, 
  Calendar, Percent, DollarSign, Users, AlertCircle,
  Check, Copy
} from 'lucide-react';

export default function CuponsPlataformaPage() {
  const [cupons, setCupons] = useState<CupomPlataforma[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCupom, setEditingCupom] = useState<CupomPlataforma | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    loadCupons();
  }, []);

  const loadCupons = async () => {
    const result = await listarCuponsPlataforma();
    if (result.success && result.cupons) {
      setCupons(result.cupons);
    }
    setLoading(false);
  };

  const handleToggle = async (id: number) => {
    await toggleCupomPlataforma(id);
    loadCupons();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este cupom?')) {
      await excluirCupomPlataforma(id);
      loadCupons();
    }
  };

  const handleCopy = (codigo: string, id: number) => {
    navigator.clipboard.writeText(codigo);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredCupons = cupons.filter(c => 
    c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full size-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cupons de Desconto</h1>
          <p className="text-slate-400 mt-1">Gerencie cupons para a landing page</p>
        </div>
        <button
          onClick={() => { setEditingCupom(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
        >
          <Plus className="size-5" />
          Novo Cupom
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar cupom..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-[#0f1f35] border border-[#1e3a5f] rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-lg p-4">
          <p className="text-slate-400 text-sm">Total de Cupons</p>
          <p className="text-2xl font-bold text-white mt-1">{cupons.length}</p>
        </div>
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-lg p-4">
          <p className="text-slate-400 text-sm">Ativos</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {cupons.filter(c => c.ativo).length}
          </p>
        </div>
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-lg p-4">
          <p className="text-slate-400 text-sm">Inativos</p>
          <p className="text-2xl font-bold text-red-400 mt-1">
            {cupons.filter(c => !c.ativo).length}
          </p>
        </div>
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-lg p-4">
          <p className="text-slate-400 text-sm">Usos Totais</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">
            {cupons.reduce((acc, c) => acc + c.uso_atual, 0)}
          </p>
        </div>
      </div>

      {/* Cupons List */}
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl overflow-hidden">
        {filteredCupons.length === 0 ? (
          <div className="p-8 text-center">
            <Ticket className="size-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {searchTerm ? 'Nenhum cupom encontrado' : 'Nenhum cupom cadastrado'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e3a5f]">
                  <th className="text-left p-4 text-slate-400 font-medium">Codigo</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Desconto</th>
                  <th className="text-left p-4 text-slate-400 font-medium hidden md:table-cell">Validade</th>
                  <th className="text-left p-4 text-slate-400 font-medium hidden lg:table-cell">Usos</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                  <th className="text-right p-4 text-slate-400 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredCupons.map((cupom) => (
                  <tr key={cupom.id} className="border-b border-[#1e3a5f]/50 hover:bg-[#1e3a5f]/20">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(cupom.codigo, cupom.id)}
                          className="flex items-center gap-2 group"
                        >
                          <span className="font-mono font-bold text-white bg-slate-800 px-3 py-1 rounded">
                            {cupom.codigo}
                          </span>
                          {copiedId === cupom.id ? (
                            <Check className="size-4 text-green-400" />
                          ) : (
                            <Copy className="size-4 text-slate-500 group-hover:text-slate-300" />
                          )}
                        </button>
                      </div>
                      {cupom.descricao && (
                        <p className="text-slate-500 text-sm mt-1">{cupom.descricao}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {cupom.tipo === 'percentual' ? (
                          <Percent className="size-4 text-purple-400" />
                        ) : (
                          <DollarSign className="size-4 text-green-400" />
                        )}
                        <span className="text-white font-medium">
                          {cupom.tipo === 'percentual' 
                            ? `${cupom.valor}%` 
                            : `R$ ${Number(cupom.valor).toFixed(2)}`}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-1">
                        {cupom.planos_aplicaveis.join(', ')}
                      </p>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="text-slate-300 text-sm">
                        <p>Inicio: {formatDate(cupom.data_inicio)}</p>
                        <p>Fim: {formatDate(cupom.data_fim)}</p>
                      </div>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-slate-400" />
                        <span className="text-white">
                          {cupom.uso_atual}
                          {cupom.uso_maximo && ` / ${cupom.uso_maximo}`}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        cupom.ativo 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}>
                        <span className={`size-1.5 rounded-full ${cupom.ativo ? 'bg-green-400' : 'bg-red-400'}`} />
                        {cupom.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggle(cupom.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            cupom.ativo 
                              ? 'hover:bg-red-500/10 text-red-400' 
                              : 'hover:bg-green-500/10 text-green-400'
                          }`}
                          title={cupom.ativo ? 'Desativar' : 'Ativar'}
                        >
                          <Power className="size-4" />
                        </button>
                        <button
                          onClick={() => { setEditingCupom(cupom); setShowModal(true); }}
                          className="p-2 hover:bg-blue-500/10 text-blue-400 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cupom.id)}
                          className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <CupomModal
          cupom={editingCupom}
          onClose={() => { setShowModal(false); setEditingCupom(null); }}
          onSuccess={() => { setShowModal(false); setEditingCupom(null); loadCupons(); }}
        />
      )}
    </div>
  );
}

// Modal Component
function CupomModal({ 
  cupom, 
  onClose, 
  onSuccess 
}: { 
  cupom: CupomPlataforma | null; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    codigo: cupom?.codigo || '',
    descricao: cupom?.descricao || '',
    tipo: cupom?.tipo || 'percentual' as 'percentual' | 'fixo',
    valor: cupom?.valor || 10,
    valor_minimo: cupom?.valor_minimo || 0,
    uso_maximo: cupom?.uso_maximo || null as number | null,
    data_inicio: cupom?.data_inicio ? cupom.data_inicio.split('T')[0] : new Date().toISOString().split('T')[0],
    data_fim: cupom?.data_fim ? cupom.data_fim.split('T')[0] : '',
    planos_aplicaveis: cupom?.planos_aplicaveis || ['start', 'pro', 'elite'],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        data_fim: formData.data_fim || null,
        uso_maximo: formData.uso_maximo || null,
      };

      let result;
      if (cupom) {
        result = await atualizarCupomPlataforma(cupom.id, payload);
      } else {
        result = await criarCupomPlataforma(payload);
      }

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Erro ao salvar cupom');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado');
    }
    
    setLoading(false);
  };

  const togglePlano = (plano: string) => {
    setFormData(prev => ({
      ...prev,
      planos_aplicaveis: prev.planos_aplicaveis.includes(plano)
        ? prev.planos_aplicaveis.filter(p => p !== plano)
        : [...prev.planos_aplicaveis, plano]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#1e3a5f]">
          <h2 className="text-lg font-semibold text-white">
            {cupom ? 'Editar Cupom' : 'Novo Cupom'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="size-4" />
              {error}
            </div>
          )}

          {/* Codigo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Codigo do Cupom
            </label>
            <input
              type="text"
              value={formData.codigo}
              onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
              placeholder="DESCONTO10"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 font-mono"
              required
            />
          </div>

          {/* Descricao */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Descricao (opcional)
            </label>
            <input
              type="text"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Desconto de lancamento"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Tipo e Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tipo de Desconto
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'percentual' | 'fixo' })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
              >
                <option value="percentual">Percentual (%)</option>
                <option value="fixo">Valor Fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Valor
              </label>
              <input
                type="number"
                step={formData.tipo === 'percentual' ? '1' : '0.01'}
                min="0"
                max={formData.tipo === 'percentual' ? '100' : undefined}
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                required
              />
            </div>
          </div>

          {/* Valor Minimo e Uso Maximo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Valor Minimo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_minimo}
                onChange={(e) => setFormData({ ...formData, valor_minimo: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Uso Maximo
              </label>
              <input
                type="number"
                min="0"
                value={formData.uso_maximo || ''}
                onChange={(e) => setFormData({ ...formData, uso_maximo: e.target.value ? Number(e.target.value) : null })}
                placeholder="Ilimitado"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Data Inicio
              </label>
              <input
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Data Fim (opcional)
              </label>
              <input
                type="date"
                value={formData.data_fim}
                onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Planos Aplicaveis */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Planos Aplicaveis
            </label>
            <div className="flex gap-2">
              {['start', 'pro', 'elite'].map((plano) => (
                <button
                  key={plano}
                  type="button"
                  onClick={() => togglePlano(plano)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.planos_aplicaveis.includes(plano)
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {plano.charAt(0).toUpperCase() + plano.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : cupom ? 'Atualizar' : 'Criar Cupom'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
