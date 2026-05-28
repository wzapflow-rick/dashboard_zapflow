'use client';

import { useEffect, useState } from 'react';
import { 
  Tag, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  Loader2,
} from 'lucide-react';
import { 
  getEtiquetas, 
  createEtiqueta, 
  updateEtiqueta, 
  deleteEtiqueta,
  type RemarketingEtiqueta,
} from '@/app/actions/remarketing';
import { cn } from '@/lib/utils';

const COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#14B8A6', '#06B6D4', '#6366F1', '#A855F7', '#D946EF',
];

export default function EtiquetasPage() {
  const [etiquetas, setEtiquetas] = useState<RemarketingEtiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEtiqueta, setEditingEtiqueta] = useState<RemarketingEtiqueta | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cor: '#3B82F6',
    ordem: 0,
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
    loadEtiquetas();
  }, []);

  const loadEtiquetas = async () => {
    setLoading(true);
    const result = await getEtiquetas();
    if (result.success) {
      setEtiquetas(result.etiquetas || []);
    }
    setLoading(false);
  };

  const openCreateModal = () => {
    setEditingEtiqueta(null);
    setFormData({
      nome: '',
      descricao: '',
      cor: '#3B82F6',
      ordem: etiquetas.length,
    });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (etiqueta: RemarketingEtiqueta) => {
    setEditingEtiqueta(etiqueta);
    setFormData({
      nome: etiqueta.nome,
      descricao: etiqueta.descricao || '',
      cor: etiqueta.cor || '#3B82F6',
      ordem: etiqueta.ordem || 0,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      setError('Nome e obrigatorio');
      return;
    }
    
    setSaving(true);
    setError('');
    
    if (editingEtiqueta) {
      const result = await updateEtiqueta(editingEtiqueta.id, formData);
      if (result.success) {
        setShowModal(false);
        loadEtiquetas();
      } else {
        setError(result.error || 'Erro ao atualizar');
      }
    } else {
      const result = await createEtiqueta(formData);
      if (result.success) {
        setShowModal(false);
        loadEtiquetas();
      } else {
        setError(result.error || 'Erro ao criar');
      }
    }
    
    setSaving(false);
  };

  const handleDelete = async (etiqueta: RemarketingEtiqueta) => {
    if (!confirm(`Excluir etiqueta "${etiqueta.nome}"?`)) return;
    
    setActionLoading(`delete-${etiqueta.id}`, true);
    const result = await deleteEtiqueta(etiqueta.id);
    if (result.success) {
      loadEtiquetas();
    }
    setActionLoading(`delete-${etiqueta.id}`, false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Etiquetas</h1>
          <p className="text-slate-400">Gerencie as etiquetas dos contatos</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all"
        >
          <Plus className="size-5" />
          Nova Etiqueta
        </button>
      </div>

      {/* Lista */}
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="size-8 animate-spin text-orange-500 mx-auto" />
            <p className="text-slate-400 mt-2">Carregando etiquetas...</p>
          </div>
        ) : etiquetas.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="size-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Nenhuma etiqueta cadastrada</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-orange-500 hover:text-orange-400"
            >
              Criar primeira etiqueta
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#1e3a5f]/50">
            {etiquetas.map((etiqueta) => (
              <div key={etiqueta.id} className="p-4 hover:bg-[#162438]/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Cor */}
                    <div
                      className="size-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: etiqueta.cor || '#3B82F6' }}
                    >
                      <Tag className="size-5 text-white" />
                    </div>
                    
                    {/* Info */}
                    <div>
                      <h3 className="font-semibold text-white">{etiqueta.nome}</h3>
                      {etiqueta.descricao && (
                        <p className="text-sm text-slate-400">{etiqueta.descricao}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(etiqueta)}
                      className="p-2 hover:bg-[#1e3a5f] rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                      <Edit2 className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(etiqueta)}
                      disabled={loadingActions.has(`delete-${etiqueta.id}`)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-slate-400 hover:text-red-400 disabled:opacity-50"
                    >
                      {loadingActions.has(`delete-${etiqueta.id}`) ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-[#1e3a5f]">
              <h2 className="text-lg font-semibold text-white">
                {editingEtiqueta ? 'Editar Etiqueta' : 'Nova Etiqueta'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-[#1e3a5f] rounded-lg text-slate-400"
              >
                <X className="size-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1e3a5f] rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ex: Cliente VIP"
                />
              </div>
              
              {/* Descricao */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Descricao
                </label>
                <input
                  type="text"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1e3a5f] rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Descricao opcional"
                />
              </div>
              
              {/* Cor */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Cor
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, cor: color })}
                      className={cn(
                        "size-8 rounded-lg transition-all",
                        formData.cor === color && "ring-2 ring-white ring-offset-2 ring-offset-[#0f1f35]"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[#1e3a5f]">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editingEtiqueta ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
