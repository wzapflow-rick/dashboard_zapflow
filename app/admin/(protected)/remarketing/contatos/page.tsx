'use client';

import { useEffect, useState } from 'react';
import { 
  Users, 
  Search, 
  RefreshCw, 
  Download, 
  Plus,
  X,
  Tag,
  Target,
  ChevronLeft,
  ChevronRight,
  Phone,
  Calendar,
  MessageSquare,
  Ban,
  Check,
  Trash2,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { 
  getContatos, 
  getEtiquetas,
  getCategorias,
  fetchEvolutionChats,
  importarContato,
  updateContato,
  deleteContato,
  addEtiquetaToContato,
  removeEtiquetaFromContato,
  addCategoriaToContato,
  removeCategoriaFromContato,
  getConfig,
  type RemarketingContato,
  type RemarketingEtiqueta,
  type RemarketingCategoria,
} from '@/app/actions/remarketing';
import { cn } from '@/lib/utils';

interface EvolutionContact {
  remote_jid: string;
  telefone: string;
  nome: string | null;
  foto_url: string | null;
  ultima_mensagem?: string | null;
}

export default function ContatosPage() {
  const [contatos, setContatos] = useState<RemarketingContato[]>([]);
  const [etiquetas, setEtiquetas] = useState<RemarketingEtiqueta[]>([]);
  const [categorias, setCategorias] = useState<RemarketingCategoria[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Modais
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEtiquetasModal, setShowEtiquetasModal] = useState(false);
  const [showCategoriasModal, setShowCategoriasModal] = useState(false);
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [selectedContato, setSelectedContato] = useState<RemarketingContato | null>(null);
  
  // Bulk selection state
  const [selectedContatos, setSelectedContatos] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  // Import state
  const [evolutionContacts, setEvolutionContacts] = useState<EvolutionContact[]>([]);
  const [filteredEvolutionContacts, setFilteredEvolutionContacts] = useState<EvolutionContact[]>([]);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [instanceName, setInstanceName] = useState('');
  const [importSearch, setImportSearch] = useState('');
  const [importFilter, setImportFilter] = useState<'all' | 'with_name' | 'without_name'>('all');

  // Loading states for individual actions
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  
  // Manual add form
  const [manualForm, setManualForm] = useState({ telefone: '', nome: '' });
  const [addingManual, setAddingManual] = useState(false);

  const setActionLoading = (key: string, loading: boolean) => {
    setLoadingActions(prev => {
      const next = new Set(prev);
      if (loading) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const loadData = async () => {
    setLoading(true);
    const [contatosRes, etiquetasRes, categoriasRes, configRes] = await Promise.all([
      getContatos(1, 50),
      getEtiquetas(),
      getCategorias(),
      getConfig(),
    ]);
    
    if (contatosRes.success) {
      setContatos(contatosRes.contatos || []);
      setPagination(contatosRes.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    }
    if (etiquetasRes.success) setEtiquetas(etiquetasRes.etiquetas || []);
    if (categoriasRes.success) setCategorias(categoriasRes.categorias || []);
    if (configRes.success && configRes.config) setInstanceName(configRes.config.instance_name || '');
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter evolution contacts when search or filter changes
  useEffect(() => {
    let filtered = evolutionContacts;
    
    if (importSearch.trim()) {
      const searchLower = importSearch.toLowerCase().trim();
      filtered = filtered.filter(c => 
        (c.nome && c.nome.toLowerCase().includes(searchLower)) ||
        c.telefone.includes(searchLower) ||
        c.remote_jid.toLowerCase().includes(searchLower)
      );
    }
    
    if (importFilter === 'with_name') {
      filtered = filtered.filter(c => c.nome && c.nome.trim() !== '');
    } else if (importFilter === 'without_name') {
      filtered = filtered.filter(c => !c.nome || c.nome.trim() === '');
    }
    
    setFilteredEvolutionContacts(filtered);
  }, [evolutionContacts, importSearch, importFilter]);

  const loadContatos = async (page: number, searchTerm = search) => {
    setLoading(true);
    const result = await getContatos(page, 50, searchTerm);
    if (result.success) {
      setContatos(result.contatos || []);
      setPagination(result.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    }
    setLoading(false);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      loadContatos(1, value);
    }, 500);
    setSearchTimeout(timeout);
  };

  const handleFetchEvolution = async () => {
    if (!instanceName) {
      alert('Configure o nome da instancia Evolution nas configuracoes');
      return;
    }
    
    setImportLoading(true);
    const result = await fetchEvolutionChats(instanceName);
    if (result.success && result.chats) {
      setEvolutionContacts(result.chats);
      setFilteredEvolutionContacts(result.chats);
      setSelectedForImport(new Set());
      setImportSearch('');
      setImportFilter('all');
    } else {
      alert(result.error || 'Erro ao buscar contatos');
    }
    setImportLoading(false);
  };

  const handleImportSelected = async () => {
    if (selectedForImport.size === 0) return;
    
    setImporting(true);
    const toImport = filteredEvolutionContacts.filter(c => selectedForImport.has(c.remote_jid));
    
    for (const contact of toImport) {
      await importarContato({
        remote_jid: contact.remote_jid,
        telefone: contact.telefone,
        nome: contact.nome || undefined,
        foto_url: contact.foto_url || undefined,
        origem: 'evolution',
      });
    }
    
    setImporting(false);
    setShowImportModal(false);
    loadContatos(1);
  };

  const handleAddManual = async () => {
    if (!manualForm.telefone.trim()) {
      alert('Telefone e obrigatorio');
      return;
    }
    
    setAddingManual(true);
    const telefone = manualForm.telefone.replace(/\D/g, '');
    const result = await importarContato({
      remote_jid: `${telefone}@s.whatsapp.net`,
      telefone: telefone,
      nome: manualForm.nome || undefined,
      origem: 'manual',
    });
    
    if (result.success) {
      setShowAddManualModal(false);
      setManualForm({ telefone: '', nome: '' });
      loadContatos(1);
    } else {
      alert(result.error || 'Erro ao adicionar contato');
    }
    setAddingManual(false);
  };

  const toggleSelectAll = () => {
    if (selectedForImport.size === filteredEvolutionContacts.length) {
      setSelectedForImport(new Set());
    } else {
      setSelectedForImport(new Set(filteredEvolutionContacts.map(c => c.remote_jid)));
    }
  };

  const toggleSelect = (jid: string) => {
    const newSet = new Set(selectedForImport);
    if (newSet.has(jid)) {
      newSet.delete(jid);
    } else {
      newSet.add(jid);
    }
    setSelectedForImport(newSet);
  };

  const handleToggleBlocked = async (contato: RemarketingContato) => {
    const key = `block-${contato.id}`;
    setActionLoading(key, true);
    await updateContato(contato.id, { bloqueado: !contato.bloqueado });
    await loadContatos(pagination.page);
    setActionLoading(key, false);
  };

  const handleDelete = async (contato: RemarketingContato) => {
    if (!confirm(`Excluir contato ${contato.nome || contato.telefone}?`)) return;
    const key = `delete-${contato.id}`;
    setActionLoading(key, true);
    await deleteContato(contato.id);
    await loadContatos(pagination.page);
    setActionLoading(key, false);
  };

  const toggleSelectContato = (id: number) => {
    const newSet = new Set(selectedContatos);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedContatos(newSet);
  };

  const toggleSelectAllContatos = () => {
    if (selectedContatos.size === contatos.length) {
      setSelectedContatos(new Set());
    } else {
      setSelectedContatos(new Set(contatos.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContatos.size === 0) return;
    if (!confirm(`Excluir ${selectedContatos.size} contatos selecionados?`)) return;
    
    setBulkDeleting(true);
    for (const id of selectedContatos) {
      await deleteContato(id);
    }
    setSelectedContatos(new Set());
    setBulkDeleting(false);
    loadContatos(1);
  };

  const openEtiquetasModal = (contato: RemarketingContato) => {
    setSelectedContato(contato);
    setShowEtiquetasModal(true);
  };

  const openCategoriasModal = (contato: RemarketingContato) => {
    setSelectedContato(contato);
    setShowCategoriasModal(true);
  };

  const handleToggleEtiqueta = async (etiquetaId: number) => {
    if (!selectedContato) return;
    
    const key = `etiqueta-${selectedContato.id}-${etiquetaId}`;
    setActionLoading(key, true);
    
    const hasEtiqueta = selectedContato.etiquetas?.some(e => e.id === etiquetaId);
    
    if (hasEtiqueta) {
      await removeEtiquetaFromContato(selectedContato.id, etiquetaId);
    } else {
      await addEtiquetaToContato(selectedContato.id, etiquetaId);
    }
    
    const result = await getContatos(pagination.page, 50, search);
    if (result.success) {
      setContatos(result.contatos || []);
      const updated = result.contatos?.find(c => c.id === selectedContato.id);
      if (updated) setSelectedContato(updated);
    }
    setActionLoading(key, false);
  };

  const handleToggleCategoria = async (categoriaId: number) => {
    if (!selectedContato) return;
    
    const key = `categoria-${selectedContato.id}-${categoriaId}`;
    setActionLoading(key, true);
    
    const hasCategoria = selectedContato.categorias?.some(c => c.id === categoriaId);
    
    if (hasCategoria) {
      await removeCategoriaFromContato(selectedContato.id, categoriaId);
    } else {
      await addCategoriaToContato(selectedContato.id, categoriaId);
    }
    
    const result = await getContatos(pagination.page, 50, search);
    if (result.success) {
      setContatos(result.contatos || []);
      const updated = result.contatos?.find(c => c.id === selectedContato.id);
      if (updated) setSelectedContato(updated);
    }
    setActionLoading(key, false);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Contatos</h1>
          <p className="text-slate-400 mt-1">
            {pagination.total} contatos no total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedContatos.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2.5 rounded-xl font-medium transition-all border border-red-500/20 disabled:opacity-50"
            >
              {bulkDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              <span>{bulkDeleting ? 'Excluindo...' : `Excluir ${selectedContatos.size}`}</span>
            </button>
          )}
          <button
            onClick={() => setShowAddManualModal(true)}
            className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white px-4 py-2.5 rounded-xl font-medium transition-all"
          >
            <UserPlus className="size-4" />
            <span>Adicionar</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-orange-500/20"
          >
            <Download className="size-4" />
            <span>Importar</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nome, telefone..."
          className="w-full bg-[#0f1f35] border border-[#1e3a5f] rounded-xl pl-12 pr-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
        />
      </div>

      {/* Contacts List */}
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-orange-500" />
          </div>
        ) : contatos.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-[#1e3a5f] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="size-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-white mb-2">Nenhum contato encontrado</p>
            <p className="text-slate-400 mb-4">Importe contatos da Evolution ou adicione manualmente</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowAddManualModal(true)}
                className="text-orange-400 hover:text-orange-300 font-medium"
              >
                Adicionar manualmente
              </button>
              <span className="text-slate-600">ou</span>
              <button
                onClick={() => setShowImportModal(true)}
                className="text-orange-400 hover:text-orange-300 font-medium"
              >
                Importar da Evolution
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#1e3a5f]/50">
            {/* Header with select all */}
            <div className="px-5 py-3 bg-[#0a1628] flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedContatos.size === contatos.length && contatos.length > 0}
                onChange={toggleSelectAllContatos}
                className="size-4 rounded border-[#1e3a5f] bg-[#0a1628] text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
              />
              <span className="text-sm text-slate-400">
                {selectedContatos.size > 0 
                  ? `${selectedContatos.size} selecionados` 
                  : 'Selecionar todos'}
              </span>
            </div>
            
            {contatos.map((contato) => (
              <div key={contato.id} className={cn(
                "p-5 transition-colors",
                selectedContatos.has(contato.id) ? "bg-orange-500/5" : "hover:bg-[#162438]/50"
              )}>
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedContatos.has(contato.id)}
                    onChange={() => toggleSelectContato(contato.id)}
                    className="mt-3 size-4 rounded border-[#1e3a5f] bg-[#0a1628] text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                  />
                  
                  {/* Avatar */}
                  <div className="size-12 bg-gradient-to-br from-[#1e3a5f] to-[#0f1f35] rounded-xl flex items-center justify-center flex-shrink-0 border border-[#1e3a5f]">
                    {contato.foto_url ? (
                      <img 
                        src={contato.foto_url} 
                        alt={contato.nome || ''} 
                        className="size-12 rounded-xl object-cover"
                      />
                    ) : (
                      <Users className="size-5 text-slate-400" />
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white">
                        {contato.nome || 'Sem nome'}
                      </p>
                      {contato.bloqueado && (
                        <span className="px-2 py-0.5 rounded-md text-xs bg-red-500/10 text-red-400 font-medium">
                          Bloqueado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Phone className="size-3" />
                      {contato.telefone}
                    </p>
                    
                    {/* Etiquetas */}
                    {contato.etiquetas && contato.etiquetas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {contato.etiquetas.map((etiqueta) => (
                          <span
                            key={etiqueta.id}
                            className="px-2 py-0.5 rounded-md text-xs font-medium"
                            style={{ 
                              backgroundColor: `${etiqueta.cor}15`,
                              color: etiqueta.cor,
                            }}
                          >
                            {etiqueta.nome}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Categorias */}
                    {contato.categorias && contato.categorias.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {contato.categorias.map((categoria) => (
                          <span
                            key={categoria.id}
                            className="px-2 py-0.5 rounded-md text-xs font-medium border"
                            style={{ 
                              borderColor: `${categoria.cor}50`,
                              color: categoria.cor,
                              backgroundColor: `${categoria.cor}10`,
                            }}
                          >
                            {categoria.nome}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Meta */}
                    <div className="flex flex-wrap gap-4 mt-2.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        Ultima: {formatDate(contato.ultima_interacao)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        {contato.total_msgs_enviadas} env. / {contato.total_msgs_recebidas} rec.
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEtiquetasModal(contato)}
                      className="p-2.5 hover:bg-[#1e3a5f] rounded-xl text-slate-400 hover:text-white transition-colors"
                      title="Etiquetas"
                    >
                      <Tag className="size-4" />
                    </button>
                    <button
                      onClick={() => openCategoriasModal(contato)}
                      className="p-2.5 hover:bg-[#1e3a5f] rounded-xl text-slate-400 hover:text-white transition-colors"
                      title="Categorias"
                    >
                      <Target className="size-4" />
                    </button>
                    <button
                      onClick={() => handleToggleBlocked(contato)}
                      disabled={loadingActions.has(`block-${contato.id}`)}
                      className={cn(
                        "p-2.5 rounded-xl transition-colors disabled:opacity-50",
                        contato.bloqueado 
                          ? "hover:bg-green-500/10 text-red-400 hover:text-green-400"
                          : "hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                      )}
                      title={contato.bloqueado ? "Desbloquear" : "Bloquear"}
                    >
                      {loadingActions.has(`block-${contato.id}`) ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : contato.bloqueado ? (
                        <Check className="size-4" />
                      ) : (
                        <Ban className="size-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(contato)}
                      disabled={loadingActions.has(`delete-${contato.id}`)}
                      className="p-2.5 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Excluir"
                    >
                      {loadingActions.has(`delete-${contato.id}`) ? (
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#1e3a5f] flex items-center justify-center bg-[#0a1628]/50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadContatos(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="p-2.5 hover:bg-[#1e3a5f] rounded-xl text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-slate-300 text-sm px-3">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => loadContatos(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="p-2.5 hover:bg-[#1e3a5f] rounded-xl text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Manual Contact */}
      {showAddManualModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <h2 className="text-xl font-bold text-white">Adicionar Contato</h2>
              <button onClick={() => setShowAddManualModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Telefone *</label>
                <input
                  type="text"
                  value={manualForm.telefone}
                  onChange={(e) => setManualForm({ ...manualForm, telefone: e.target.value })}
                  placeholder="5511999999999"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
                <p className="text-xs text-slate-500 mt-1">Apenas numeros, com DDD e codigo do pais</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nome (opcional)</label>
                <input
                  type="text"
                  value={manualForm.nome}
                  onChange={(e) => setManualForm({ ...manualForm, nome: e.target.value })}
                  placeholder="Nome do contato"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddManualModal(false)}
                  className="flex-1 px-4 py-3 border border-[#1e3a5f] rounded-xl text-slate-300 hover:bg-[#1e3a5f] transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddManual}
                  disabled={addingManual || !manualForm.telefone.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                >
                  {addingManual ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  <span>{addingManual ? 'Adicionando...' : 'Adicionar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import from Evolution */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <h2 className="text-xl font-bold text-white">Importar Contatos</h2>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="Nome da instancia"
                  className="flex-1 bg-[#0a1628] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
                <button
                  onClick={handleFetchEvolution}
                  disabled={importLoading}
                  className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white px-5 py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {importLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  <span>Buscar</span>
                </button>
              </div>

              {evolutionContacts.length > 0 && (
                <>
                  {/* Search and Filter */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                      <input
                        type="text"
                        value={importSearch}
                        onChange={(e) => setImportSearch(e.target.value)}
                        placeholder="Buscar por nome ou telefone..."
                        className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                      />
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setImportFilter('all')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                          importFilter === 'all'
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "bg-[#0a1628] text-slate-400 border border-[#1e3a5f] hover:bg-[#162438]"
                        )}
                      >
                        Todos ({evolutionContacts.length})
                      </button>
                      <button
                        onClick={() => setImportFilter('with_name')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                          importFilter === 'with_name'
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-[#0a1628] text-slate-400 border border-[#1e3a5f] hover:bg-[#162438]"
                        )}
                      >
                        Com nome ({evolutionContacts.filter(c => c.nome && c.nome.trim()).length})
                      </button>
                      <button
                        onClick={() => setImportFilter('without_name')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                          importFilter === 'without_name'
                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                            : "bg-[#0a1628] text-slate-400 border border-[#1e3a5f] hover:bg-[#162438]"
                        )}
                      >
                        Sem nome ({evolutionContacts.filter(c => !c.nome || !c.nome.trim()).length})
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedForImport.size === filteredEvolutionContacts.length && filteredEvolutionContacts.length > 0}
                        onChange={toggleSelectAll}
                        className="size-4 rounded border-[#1e3a5f] bg-[#0a1628] text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                      />
                      Selecionar todos ({filteredEvolutionContacts.length})
                    </label>
                    <span className="text-sm text-slate-500">
                      {selectedForImport.size} selecionados
                    </span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {filteredEvolutionContacts.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <Search className="size-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhum contato encontrado</p>
                      </div>
                    ) : (
                      filteredEvolutionContacts.map((contact) => (
                        <label
                          key={contact.remote_jid}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                            selectedForImport.has(contact.remote_jid)
                              ? "bg-orange-500/10 border-orange-500/30"
                              : "bg-[#0a1628] border-[#1e3a5f] hover:bg-[#162438] hover:border-[#2a4a6f]"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedForImport.has(contact.remote_jid)}
                            onChange={() => toggleSelect(contact.remote_jid)}
                            className="size-4 rounded border-[#1e3a5f] bg-[#0a1628] text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                          />
                          <div className="size-10 bg-gradient-to-br from-[#1e3a5f] to-[#0f1f35] rounded-lg flex items-center justify-center flex-shrink-0">
                            {contact.foto_url ? (
                              <img 
                                src={contact.foto_url} 
                                alt="" 
                                className="size-10 rounded-lg object-cover"
                              />
                            ) : (
                              <Users className="size-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">
                              {contact.nome || 'Sem nome'}
                            </p>
                            <p className="text-sm text-slate-400">{contact.telefone}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-[#1e3a5f] flex gap-3 bg-[#0a1628]/50">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 px-4 py-3 border border-[#1e3a5f] rounded-xl text-slate-300 hover:bg-[#1e3a5f] transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportSelected}
                disabled={importing || selectedForImport.size === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
              >
                {importing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                <span>{importing ? 'Importando...' : `Importar ${selectedForImport.size} contatos`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Etiquetas */}
      {showEtiquetasModal && selectedContato && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <div>
                <h2 className="text-xl font-bold text-white">Etiquetas</h2>
                <p className="text-sm text-slate-400">{selectedContato.nome || selectedContato.telefone}</p>
              </div>
              <button onClick={() => setShowEtiquetasModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-2 max-h-80 overflow-y-auto">
              {etiquetas.length === 0 ? (
                <p className="text-slate-400 text-center py-4">Nenhuma etiqueta cadastrada</p>
              ) : (
                etiquetas.filter(e => e.ativo).map((etiqueta) => {
                  const isActive = selectedContato.etiquetas?.some(e => e.id === etiqueta.id);
                  const isLoading = loadingActions.has(`etiqueta-${selectedContato.id}-${etiqueta.id}`);
                  return (
                    <button
                      key={etiqueta.id}
                      onClick={() => handleToggleEtiqueta(etiqueta.id)}
                      disabled={isLoading}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border transition-all disabled:opacity-50",
                        isActive
                          ? "border-opacity-50"
                          : "bg-[#0a1628] border-[#1e3a5f] hover:bg-[#162438]"
                      )}
                      style={isActive ? { 
                        backgroundColor: `${etiqueta.cor}15`,
                        borderColor: `${etiqueta.cor}50`,
                      } : {}}
                    >
                      <div 
                        className="size-4 rounded-full"
                        style={{ backgroundColor: etiqueta.cor }}
                      />
                      <span className="flex-1 text-left font-medium" style={{ color: isActive ? etiqueta.cor : 'white' }}>
                        {etiqueta.nome}
                      </span>
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin text-slate-400" />
                      ) : isActive ? (
                        <Check className="size-4" style={{ color: etiqueta.cor }} />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Categorias */}
      {showCategoriasModal && selectedContato && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <div>
                <h2 className="text-xl font-bold text-white">Categorias</h2>
                <p className="text-sm text-slate-400">{selectedContato.nome || selectedContato.telefone}</p>
              </div>
              <button onClick={() => setShowCategoriasModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-2 max-h-80 overflow-y-auto">
              {categorias.length === 0 ? (
                <p className="text-slate-400 text-center py-4">Nenhuma categoria cadastrada</p>
              ) : (
                categorias.filter(c => c.ativo).map((categoria) => {
                  const isActive = selectedContato.categorias?.some(c => c.id === categoria.id);
                  const isLoading = loadingActions.has(`categoria-${selectedContato.id}-${categoria.id}`);
                  return (
                    <button
                      key={categoria.id}
                      onClick={() => handleToggleCategoria(categoria.id)}
                      disabled={isLoading}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border transition-all disabled:opacity-50",
                        isActive
                          ? "border-opacity-50"
                          : "bg-[#0a1628] border-[#1e3a5f] hover:bg-[#162438]"
                      )}
                      style={isActive ? { 
                        backgroundColor: `${categoria.cor}15`,
                        borderColor: `${categoria.cor}50`,
                      } : {}}
                    >
                      <div 
                        className="size-4 rounded-full"
                        style={{ backgroundColor: categoria.cor }}
                      />
                      <span className="flex-1 text-left font-medium" style={{ color: isActive ? categoria.cor : 'white' }}>
                        {categoria.nome}
                      </span>
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin text-slate-400" />
                      ) : isActive ? (
                        <Check className="size-4" style={{ color: categoria.cor }} />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
