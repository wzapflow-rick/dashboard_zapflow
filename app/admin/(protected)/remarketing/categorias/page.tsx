'use client';

import { useEffect, useState } from 'react';
import { 
  Target, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  AlertCircle,
  Check,
  Loader2,
} from 'lucide-react';
import { 
  getCategorias, 
  createCategoria, 
  updateCategoria, 
  deleteCategoria,
  type RemarketingCategoria,
} from '@/app/actions/remarketing';
import { cn } from '@/lib/utils';

const COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#14B8A6', '#06B6D4', '#6366F1', '#A855F7', '#D946EF',
];

const PRIORIDADES = [
  { value: 1, label: 'Urgente', color: 'red' },
  { value: 2, label: 'Alta', color: 'orange' },
  { value: 3, label: 'Media', color: 'yellow' },
  { value: 4, label: 'Baixa', color: 'blue' },
  { value: 5, label: 'Quando possivel', color: 'slate' },
];

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<RemarketingCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<RemarketingCategoria | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cor: '#3B82F6',
    icone: 'tag',
    prioridade: 3,
    cooldown_horas: 24,
    tipo_selecao: 'manual' as 'automatica' | 'manual',
    mensagem_modo: 'automatico' as 'automatico' | 'escolher',
    ativo: true,
  });

  const setActionLoading = (key: string, isLoading: boolean) => {
    setLoadingActions(prev => {
      const next = new Set(prev);
      if (isLoading) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  useEffect(() => {
    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    setLoading(true);
    const result = await getCategorias();
    if (result.success) {
      setCategorias(result.categorias || []);
    }
    setLoading(false);
  };

  const openCreateModal = () => {
    setEditingCategoria(null);
    setFormData({
      nome: '',
      descricao: '',
      cor: '#3B82F6',
      icone: 'tag',
      prioridade: 3,
      cooldown_horas: 24,
      tipo_selecao: 'manual',
      mensagem_modo: 'automatico',
      ativo: true,
    });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (categoria: RemarketingCategoria) => {
    setEditingCategoria(categoria);
    setFormData({
      nome: categoria.nome,
      descricao: categoria.descricao || '',
      cor: categoria.cor,
      icone: categoria.icone,
      prioridade: categoria.prioridade,
      cooldown_horas: categoria.cooldown_horas,
      tipo_selecao: categoria.tipo_selecao,
      mensagem_modo: categoria.mensagem_modo,
      ativo: categoria.ativo,
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      setError('Nome e obrigatorio');
      return;
    }
    
    setSaving(true);
    setError('');
    
    let result;
    if (editingCategoria) {
      result = await updateCategoria(editingCategoria.id, formData);
    } else {
      result = await createCategoria(formData);
    }
    
    if (result.success) {
      setShowModal(false);
      loadCategorias();
    } else {
      setError(result.error || 'Erro ao salvar');
    }
    
    setSaving(false);
  };

  const handleDelete = async (categoria: RemarketingCategoria) => {
    if (!confirm(`Excluir categoria "${categoria.nome}"?`)) return;
    
    const key = `delete-${categoria.id}`;
    setActionLoading(key, true);
    const result = await deleteCategoria(categoria.id);
    if (result.success) {
      await loadCategorias();
    }
    setActionLoading(key, false);
  };

  const handleToggleAtivo = async (categoria: RemarketingCategoria) => {
    const key = `toggle-${categoria.id}`;
    setActionLoading(key, true);
    await updateCategoria(categoria.id, { ativo: !categoria.ativo });
    await loadCategorias();
    setActionLoading(key, false);
  };

  const getPrioridadeInfo = (prioridade: number) => {
    return PRIORIDADES.find(p => p.value === prioridade) || PRIORIDADES[2];
  };

  const getPrioridadeClasses = (color: string) => {
    const classes: Record<string, string> = {
      red: 'bg-red-500/10 text-red-400',
      orange: 'bg-orange-500/10 text-orange-400',
      yellow: 'bg-yellow-500/10 text-yellow-400',
      blue: 'bg-blue-500/10 text-blue-400',
      slate: 'bg-slate-500/10 text-slate-400',
    };
    return classes[color] || classes.slate;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Categorias</h1>
          <p className="text-slate-400 mt-1">
            Gerencie as categorias de remarketing
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-orange-500/20"
        >
          <Plus className="size-5" />
          <span>Nova Categoria</span>
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-orange-500" />
          </div>
        ) : categorias.length === 0 ? (
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl text-center py-16 px-4">
            <div className="w-16 h-16 bg-[#1e3a5f] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Target className="size-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-white mb-2">Nenhuma categoria cadastrada</p>
            <p className="text-slate-400 mb-4">Crie categorias para organizar seus contatos</p>
            <button
              onClick={openCreateModal}
              className="text-orange-400 hover:text-orange-300 font-medium"
            >
              Criar primeira categoria
            </button>
          </div>
        ) : (
          categorias.map((categoria) => {
            const prioridadeInfo = getPrioridadeInfo(categoria.prioridade);
            const isDeleting = loadingActions.has(`delete-${categoria.id}`);
            const isToggling = loadingActions.has(`toggle-${categoria.id}`);
            
            return (
              <div
                key={categoria.id}
                className={cn(
                  "bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl p-5 transition-all hover:border-[#2a4a6f]",
                  !categoria.ativo && "opacity-60"
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Color indicator */}
                  <div 
                    className="size-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${categoria.cor}15` }}
                  >
                    <div 
                      className="size-8 rounded-lg"
                      style={{ backgroundColor: categoria.cor }}
                    />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white text-lg">{categoria.nome}</p>
                      {!categoria.ativo && (
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-500/10 text-slate-400">
                          Inativo
                        </span>
                      )}
                    </div>
                    {categoria.descricao && (
                      <p className="text-sm text-slate-400 truncate mt-0.5">{categoria.descricao}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium",
                        getPrioridadeClasses(prioridadeInfo.color)
                      )}>
                        {prioridadeInfo.label}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-500/10 text-slate-400">
                        Cooldown: {categoria.cooldown_horas}h
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-500/10 text-slate-400">
                        {categoria.tipo_selecao === 'automatica' ? 'Automatica' : 'Manual'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleAtivo(categoria)}
                      disabled={isToggling || isDeleting}
                      className={cn(
                        "p-2.5 rounded-xl transition-colors disabled:opacity-50",
                        categoria.ativo
                          ? "hover:bg-yellow-500/10 text-slate-400 hover:text-yellow-400"
                          : "hover:bg-green-500/10 text-slate-400 hover:text-green-400"
                      )}
                      title={categoria.ativo ? "Desativar" : "Ativar"}
                    >
                      {isToggling ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                    </button>
                    <button
                      onClick={() => openEditModal(categoria)}
                      disabled={isDeleting}
                      className="p-2.5 hover:bg-[#1e3a5f] rounded-xl text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                      title="Editar"
                    >
                      <Edit2 className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(categoria)}
                      disabled={isToggling || isDeleting}
                      className="p-2.5 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Excluir"
                    >
                      {isDeleting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <h2 className="text-xl font-bold text-white">
                {editingCategoria ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="size-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nome *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                  placeholder="Ex: Cliente Inativo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Descricao</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
                  rows={2}
                  placeholder="Descricao opcional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, cor: color })}
                      className={cn(
                        "size-9 rounded-xl transition-all",
                        formData.cor === color && "ring-2 ring-white ring-offset-2 ring-offset-[#0f1f35] scale-110"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Prioridade</label>
                <select
                  value={formData.prioridade}
                  onChange={(e) => setFormData({ ...formData, prioridade: parseInt(e.target.value) })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Cooldown (horas entre mensagens)
                </label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={formData.cooldown_horas}
                  onChange={(e) => setFormData({ ...formData, cooldown_horas: parseInt(e.target.value) || 24 })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Tipo de Selecao</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.tipo_selecao === 'manual'}
                      onChange={() => setFormData({ ...formData, tipo_selecao: 'manual' })}
                      className="text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                    />
                    <span className="text-white">Manual</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.tipo_selecao === 'automatica'}
                      onChange={() => setFormData({ ...formData, tipo_selecao: 'automatica' })}
                      className="text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                    />
                    <span className="text-white">Automatica</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Modo de Mensagem</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.mensagem_modo === 'automatico'}
                      onChange={() => setFormData({ ...formData, mensagem_modo: 'automatico' })}
                      className="text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                    />
                    <span className="text-white">Automatico</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.mensagem_modo === 'escolher'}
                      onChange={() => setFormData({ ...formData, mensagem_modo: 'escolher' })}
                      className="text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                    />
                    <span className="text-white">Escolher</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 border border-[#1e3a5f] rounded-xl text-slate-300 hover:bg-[#1e3a5f] transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  <span>{saving ? 'Salvando...' : 'Salvar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
