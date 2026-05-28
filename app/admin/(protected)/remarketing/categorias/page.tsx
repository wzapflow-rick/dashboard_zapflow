'use client';

import { useEffect, useState } from 'react';
import { 
  Target, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  AlertCircle,
  GripVertical,
  Check,
} from 'lucide-react';
import { 
  getCategorias, 
  createCategoria, 
  updateCategoria, 
  deleteCategoria,
  type RemarketingCategoria,
} from '@/app/actions/remarketing';
import { cn } from '@/lib/utils';

const ICONS = [
  'tag', 'target', 'users', 'heart', 'star', 'zap', 'bell', 'gift',
  'clock', 'calendar', 'shopping-cart', 'percent', 'award', 'flame',
];

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
    
    const result = await deleteCategoria(categoria.id);
    if (result.success) {
      loadCategorias();
    }
  };

  const handleToggleAtivo = async (categoria: RemarketingCategoria) => {
    await updateCategoria(categoria.id, { ativo: !categoria.ativo });
    loadCategorias();
  };

  const getPrioridadeInfo = (prioridade: number) => {
    return PRIORIDADES.find(p => p.value === prioridade) || PRIORIDADES[2];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Categorias</h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            Gerencie as categorias de remarketing
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all w-full sm:w-auto"
        >
          <Plus className="size-5" />
          <span>Nova Categoria</span>
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : categorias.length === 0 ? (
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl text-center py-12 text-slate-400">
            <Target className="size-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma categoria cadastrada</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-orange-400 hover:text-orange-300"
            >
              Criar primeira categoria
            </button>
          </div>
        ) : (
          categorias.map((categoria) => {
            const prioridadeInfo = getPrioridadeInfo(categoria.prioridade);
            return (
              <div
                key={categoria.id}
                className={cn(
                  "bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-4 transition-opacity",
                  !categoria.ativo && "opacity-50"
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Cor/Icone */}
                  <div 
                    className="size-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${categoria.cor}20` }}
                  >
                    <div 
                      className="size-6 rounded-full"
                      style={{ backgroundColor: categoria.cor }}
                    />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{categoria.nome}</p>
                      {!categoria.ativo && (
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-500/10 text-slate-400">
                          Inativo
                        </span>
                      )}
                    </div>
                    {categoria.descricao && (
                      <p className="text-sm text-slate-400 truncate">{categoria.descricao}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span 
                        className={cn(
                          "px-2 py-0.5 rounded text-xs",
                          prioridadeInfo.color === 'red' && "bg-red-500/10 text-red-400",
                          prioridadeInfo.color === 'orange' && "bg-orange-500/10 text-orange-400",
                          prioridadeInfo.color === 'yellow' && "bg-yellow-500/10 text-yellow-400",
                          prioridadeInfo.color === 'blue' && "bg-blue-500/10 text-blue-400",
                          prioridadeInfo.color === 'slate' && "bg-slate-500/10 text-slate-400",
                        )}
                      >
                        {prioridadeInfo.label}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-500/10 text-slate-400">
                        Cooldown: {categoria.cooldown_horas}h
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-500/10 text-slate-400">
                        {categoria.tipo_selecao === 'automatica' ? 'Automatica' : 'Manual'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleAtivo(categoria)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        categoria.ativo
                          ? "hover:bg-yellow-500/10 text-slate-400 hover:text-yellow-400"
                          : "hover:bg-green-500/10 text-slate-400 hover:text-green-400"
                      )}
                      title={categoria.ativo ? "Desativar" : "Ativar"}
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(categoria)}
                      className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(categoria)}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <h2 className="text-xl font-bold text-white">
                {editingCategoria ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
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
                <label className="block text-sm font-medium text-slate-300 mb-2">Nome *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                  placeholder="Ex: Cliente Inativo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Descricao</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 resize-none"
                  rows={2}
                  placeholder="Descricao opcional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, cor: color })}
                      className={cn(
                        "size-8 rounded-lg transition-transform",
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
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
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
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Selecao</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.tipo_selecao === 'manual'}
                      onChange={() => setFormData({ ...formData, tipo_selecao: 'manual' })}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-white">Manual</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.tipo_selecao === 'automatica'}
                      onChange={() => setFormData({ ...formData, tipo_selecao: 'automatica' })}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-white">Automatica</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Modo de Mensagem</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.mensagem_modo === 'automatico'}
                      onChange={() => setFormData({ ...formData, mensagem_modo: 'automatico' })}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-white">Automatico</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.mensagem_modo === 'escolher'}
                      onChange={() => setFormData({ ...formData, mensagem_modo: 'escolher' })}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-white">Escolher</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 border border-[#1e3a5f] rounded-lg text-slate-300 hover:bg-[#1e3a5f] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
