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
  Filter
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
  const [selectedContato, setSelectedContato] = useState<RemarketingContato | null>(null);
  
  // Import state
  const [evolutionContacts, setEvolutionContacts] = useState<EvolutionContact[]>([]);
  const [filteredEvolutionContacts, setFilteredEvolutionContacts] = useState<EvolutionContact[]>([]);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [instanceName, setInstanceName] = useState('');
  const [importSearch, setImportSearch] = useState('');
  const [importFilter, setImportFilter] = useState<'all' | 'with_name' | 'without_name'>('all');

  useEffect(() => {
    loadData();
  }, []);

  // Filter evolution contacts when search or filter changes
  useEffect(() => {
    let filtered = evolutionContacts;
    
    // Apply search filter
    if (importSearch.trim()) {
      const searchLower = importSearch.toLowerCase().trim();
      filtered = filtered.filter(c => 
        (c.nome && c.nome.toLowerCase().includes(searchLower)) ||
        c.telefone.includes(searchLower) ||
        c.remote_jid.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply name filter
    if (importFilter === 'with_name') {
      filtered = filtered.filter(c => c.nome && c.nome.trim() !== '');
    } else if (importFilter === 'without_name') {
      filtered = filtered.filter(c => !c.nome || c.nome.trim() === '');
    }
    
    setFilteredEvolutionContacts(filtered);
  }, [evolutionContacts, importSearch, importFilter]);

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
    await updateContato(contato.id, { bloqueado: !contato.bloqueado });
    loadContatos(pagination.page);
  };

  const handleDelete = async (contato: RemarketingContato) => {
    if (!confirm(`Excluir contato ${contato.nome || contato.telefone}?`)) return;
    await deleteContato(contato.id);
    loadContatos(pagination.page);
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
    
    const hasEtiqueta = selectedContato.etiquetas?.some(e => e.id === etiquetaId);
    
    if (hasEtiqueta) {
      await removeEtiquetaFromContato(selectedContato.id, etiquetaId);
    } else {
      await addEtiquetaToContato(selectedContato.id, etiquetaId);
    }
    
    // Reload contatos to update the view
    const result = await getContatos(pagination.page, 50, search);
    if (result.success) {
      setContatos(result.contatos || []);
      const updated = result.contatos?.find(c => c.id === selectedContato.id);
      if (updated) setSelectedContato(updated);
    }
  };

  const handleToggleCategoria = async (categoriaId: number) => {
    if (!selectedContato) return;
    
    const hasCategoria = selectedContato.categorias?.some(c => c.id === categoriaId);
    
    if (hasCategoria) {
      await removeCategoriaFromContato(selectedContato.id, categoriaId);
    } else {
      await addCategoriaToContato(selectedContato.id, categoriaId);
    }
    
    // Reload contatos to update the view
    const result = await getContatos(pagination.page, 50, search);
    if (result.success) {
      setContatos(result.contatos || []);
      const updated = result.contatos?.find(c => c.id === selectedContato.id);
      if (updated) setSelectedContato(updated);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Contatos</h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            {pagination.total} contatos no total
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all"
          >
            <Download className="size-5" />
            <span>Importar</span>
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nome, telefone..."
          className="w-full bg-[#0f1f35] border border-[#1e3a5f] rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Lista de Contatos */}
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : contatos.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="size-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum contato encontrado</p>
            <button
              onClick={() => setShowImportModal(true)}
              className="mt-4 text-orange-400 hover:text-orange-300"
            >
              Importar contatos da Evolution
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#1e3a5f]/50">
            {contatos.map((contato) => (
              <div key={contato.id} className="p-4 hover:bg-[#162438]/50">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="size-12 bg-[#1e3a5f] rounded-full flex items-center justify-center flex-shrink-0">
                    {contato.foto_url ? (
                      <img 
                        src={contato.foto_url} 
                        alt={contato.nome || ''} 
                        className="size-12 rounded-full object-cover"
                      />
                    ) : (
                      <Users className="size-6 text-slate-400" />
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white truncate">
                        {contato.nome || 'Sem nome'}
                      </p>
                      {contato.bloqueado && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400">
                          Bloqueado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 flex items-center gap-1">
                      <Phone className="size-3" />
                      {contato.telefone}
                    </p>
                    
                    {/* Etiquetas */}
                    {contato.etiquetas && contato.etiquetas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {contato.etiquetas.map((etiqueta) => (
                          <span
                            key={etiqueta.id}
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ 
                              backgroundColor: `${etiqueta.cor}20`,
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
                      <div className="flex flex-wrap gap-1 mt-1">
                        {contato.categorias.map((categoria) => (
                          <span
                            key={categoria.id}
                            className="px-2 py-0.5 rounded text-xs border"
                            style={{ 
                              borderColor: categoria.cor,
                              color: categoria.cor,
                            }}
                          >
                            {categoria.nome}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Meta */}
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        Ultima: {formatDate(contato.ultima_interacao)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        {contato.total_msgs_enviadas} enviadas / {contato.total_msgs_recebidas} recebidas
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEtiquetasModal(contato)}
                      className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white transition-colors"
                      title="Etiquetas"
                    >
                      <Tag className="size-4" />
                    </button>
                    <button
                      onClick={() => openCategoriasModal(contato)}
                      className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white transition-colors"
                      title="Categorias"
                    >
                      <Target className="size-4" />
                    </button>
                    <button
                      onClick={() => handleToggleBlocked(contato)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        contato.bloqueado 
                          ? "hover:bg-green-500/10 text-red-400 hover:text-green-400"
                          : "hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                      )}
                      title={contato.bloqueado ? "Desbloquear" : "Bloquear"}
                    >
                      {contato.bloqueado ? <Check className="size-4" /> : <Ban className="size-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(contato)}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginacao */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#1e3a5f] flex items-center justify-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadContatos(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-slate-300 text-sm">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => loadContatos(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Importar */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <h2 className="text-xl font-bold text-white">Importar Contatos</h2>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white">
                <X className="size-6" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="Nome da instancia Evolution"
                  className="flex-1 bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={handleFetchEvolution}
                  disabled={importLoading || !instanceName}
                  className="flex items-center gap-2 bg-[#162438] hover:bg-[#1e3a5f] text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-4", importLoading && "animate-spin")} />
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
                        className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setImportFilter('all')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm transition-colors",
                          importFilter === 'all'
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                            : "bg-[#0a1628] text-slate-400 border border-[#1e3a5f] hover:bg-[#162438]"
                        )}
                      >
                        Todos ({evolutionContacts.length})
                      </button>
                      <button
                        onClick={() => setImportFilter('with_name')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm transition-colors",
                          importFilter === 'with_name'
                            ? "bg-green-500/20 text-green-400 border border-green-500/50"
                            : "bg-[#0a1628] text-slate-400 border border-[#1e3a5f] hover:bg-[#162438]"
                        )}
                      >
                        Com nome ({evolutionContacts.filter(c => c.nome && c.nome.trim()).length})
                      </button>
                      <button
                        onClick={() => setImportFilter('without_name')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm transition-colors",
                          importFilter === 'without_name'
                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                            : "bg-[#0a1628] text-slate-400 border border-[#1e3a5f] hover:bg-[#162438]"
                        )}
                      >
                        Sem nome ({evolutionContacts.filter(c => !c.nome || !c.nome.trim()).length})
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <input
                        type="checkbox"
                        checked={selectedForImport.size === filteredEvolutionContacts.length && filteredEvolutionContacts.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-[#1e3a5f] bg-[#0a1628] text-orange-500 focus:ring-orange-500"
                      />
                      Selecionar todos ({filteredEvolutionContacts.length})
                    </label>
                    <span className="text-sm text-slate-500">
                      {selectedForImport.size} selecionados
                    </span>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filteredEvolutionContacts.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <Search className="size-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhum contato encontrado com os filtros aplicados</p>
                      </div>
                    ) : (
                      filteredEvolutionContacts.map((contact) => (
                        <label
                          key={contact.remote_jid}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            selectedForImport.has(contact.remote_jid)
                              ? "bg-orange-500/10 border-orange-500/50"
                              : "bg-[#0a1628] border-[#1e3a5f] hover:bg-[#162438]"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedForImport.has(contact.remote_jid)}
                            onChange={() => toggleSelect(contact.remote_jid)}
                            className="rounded border-[#1e3a5f] bg-[#0a1628] text-orange-500 focus:ring-orange-500"
                          />
                          <div className="size-10 bg-[#1e3a5f] rounded-full flex items-center justify-center flex-shrink-0">
                            {contact.foto_url ? (
                              <img 
                                src={contact.foto_url} 
                                alt="" 
                                className="size-10 rounded-full object-cover"
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

              {evolutionContacts.length === 0 && !importLoading && (
                <div className="text-center py-8 text-slate-400">
                  <Download className="size-12 mx-auto mb-4 opacity-50" />
                  <p>Clique em &quot;Buscar&quot; para carregar contatos da Evolution API</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[#1e3a5f] flex gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 px-4 py-3 border border-[#1e3a5f] rounded-lg text-slate-300 hover:bg-[#1e3a5f] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportSelected}
                disabled={selectedForImport.size === 0 || importing}
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {importing ? 'Importando...' : `Importar ${selectedForImport.size} contatos`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Etiquetas */}
      {showEtiquetasModal && selectedContato && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <h2 className="text-xl font-bold text-white">Etiquetas</h2>
              <button 
                onClick={() => { setShowEtiquetasModal(false); setSelectedContato(null); }} 
                className="text-slate-400 hover:text-white"
              >
                <X className="size-6" />
              </button>
            </div>

            <div className="p-6 space-y-2 max-h-96 overflow-y-auto">
              {etiquetas.length === 0 ? (
                <p className="text-center text-slate-400 py-4">
                  Nenhuma etiqueta cadastrada
                </p>
              ) : (
                etiquetas.map((etiqueta) => {
                  const isSelected = selectedContato.etiquetas?.some(e => e.id === etiqueta.id);
                  return (
                    <button
                      key={etiqueta.id}
                      onClick={() => handleToggleEtiqueta(etiqueta.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        isSelected
                          ? "bg-opacity-20 border-opacity-50"
                          : "bg-[#0a1628] border-[#1e3a5f] hover:bg-[#162438]"
                      )}
                      style={isSelected ? { 
                        backgroundColor: `${etiqueta.cor}20`,
                        borderColor: `${etiqueta.cor}80`,
                      } : {}}
                    >
                      <div 
                        className="size-4 rounded-full"
                        style={{ backgroundColor: etiqueta.cor }}
                      />
                      <span className="flex-1 text-left text-white">{etiqueta.nome}</span>
                      {isSelected && <Check className="size-4 text-green-400" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Categorias */}
      {showCategoriasModal && selectedContato && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <h2 className="text-xl font-bold text-white">Categorias</h2>
              <button 
                onClick={() => { setShowCategoriasModal(false); setSelectedContato(null); }} 
                className="text-slate-400 hover:text-white"
              >
                <X className="size-6" />
              </button>
            </div>

            <div className="p-6 space-y-2 max-h-96 overflow-y-auto">
              {categorias.length === 0 ? (
                <p className="text-center text-slate-400 py-4">
                  Nenhuma categoria cadastrada
                </p>
              ) : (
                categorias.map((categoria) => {
                  const isSelected = selectedContato.categorias?.some(c => c.id === categoria.id);
                  return (
                    <button
                      key={categoria.id}
                      onClick={() => handleToggleCategoria(categoria.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        isSelected
                          ? "bg-opacity-20 border-opacity-50"
                          : "bg-[#0a1628] border-[#1e3a5f] hover:bg-[#162438]"
                      )}
                      style={isSelected ? { 
                        backgroundColor: `${categoria.cor}20`,
                        borderColor: `${categoria.cor}80`,
                      } : {}}
                    >
                      <div 
                        className="size-4 rounded-full"
                        style={{ backgroundColor: categoria.cor }}
                      />
                      <div className="flex-1 text-left">
                        <span className="text-white">{categoria.nome}</span>
                        <span className="text-xs text-slate-500 ml-2">
                          Prioridade {categoria.prioridade}
                        </span>
                      </div>
                      {isSelected && <Check className="size-4 text-green-400" />}
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
