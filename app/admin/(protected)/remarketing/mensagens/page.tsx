'use client';

import { useEffect, useState } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  AlertCircle,
  Check,
  Image,
  Video,
  FileText,
  Mic,
  Link2,
} from 'lucide-react';
import { 
  getMensagens, 
  getTiposDor,
  createMensagem, 
  updateMensagem, 
  deleteMensagem,
  createTipoDor,
  updateTipoDor,
  deleteTipoDor,
  getCategorias,
  getCombinacoes,
  createCombinacao,
  deleteCombinacao,
  type RemarketingMensagem,
  type RemarketingTipoDor,
  type RemarketingCategoria,
  type RemarketingCombinacao,
} from '@/app/actions/remarketing';
import { cn } from '@/lib/utils';

const TIPOS_MIDIA = [
  { value: 'texto', label: 'Texto', icon: MessageSquare },
  { value: 'imagem', label: 'Imagem', icon: Image },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'audio', label: 'Audio', icon: Mic },
  { value: 'documento', label: 'Documento', icon: FileText },
];

const VARIAVEIS = [
  { key: 'nome', label: 'Nome do contato' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'dias_ausente', label: 'Dias sem interacao' },
  { key: 'ultima_compra', label: 'Ultima compra' },
];

export default function MensagensPage() {
  const [mensagens, setMensagens] = useState<RemarketingMensagem[]>([]);
  const [tiposDor, setTiposDor] = useState<RemarketingTipoDor[]>([]);
  const [categorias, setCategorias] = useState<RemarketingCategoria[]>([]);
  const [combinacoes, setCombinacoes] = useState<RemarketingCombinacao[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Mensagem Modal
  const [showMensagemModal, setShowMensagemModal] = useState(false);
  const [editingMensagem, setEditingMensagem] = useState<RemarketingMensagem | null>(null);
  
  // Tipo Dor Modal
  const [showTipoDorModal, setShowTipoDorModal] = useState(false);
  const [editingTipoDor, setEditingTipoDor] = useState<RemarketingTipoDor | null>(null);
  
  // Combinacoes Modal
  const [showCombinacoesModal, setShowCombinacoesModal] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Form states
  const [mensagemForm, setMensagemForm] = useState({
    nome: '',
    tipo_dor_id: null as number | null,
    conteudo: '',
    tipo_midia: 'texto',
    midia_url: '',
    ativo: true,
  });
  
  const [tipoDorForm, setTipoDorForm] = useState({
    nome: '',
    descricao: '',
    icone: '',
    ativo: true,
  });
  
  const [combinacaoForm, setCombinacaoForm] = useState({
    categoria_id: null as number | null,
    tipo_dor_id: null as number | null,
    mensagem_id: null as number | null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [msgRes, tiposRes, catRes, combRes] = await Promise.all([
      getMensagens(),
      getTiposDor(),
      getCategorias(),
      getCombinacoes(),
    ]);
    
    if (msgRes.success) setMensagens(msgRes.mensagens || []);
    if (tiposRes.success) setTiposDor(tiposRes.tipos || []);
    if (catRes.success) setCategorias(catRes.categorias || []);
    if (combRes.success) setCombinacoes(combRes.combinacoes || []);
    
    setLoading(false);
  };

  // === MENSAGENS ===
  const openCreateMensagem = () => {
    setEditingMensagem(null);
    setMensagemForm({
      nome: '',
      tipo_dor_id: null,
      conteudo: '',
      tipo_midia: 'texto',
      midia_url: '',
      ativo: true,
    });
    setError('');
    setShowMensagemModal(true);
  };

  const openEditMensagem = (msg: RemarketingMensagem) => {
    setEditingMensagem(msg);
    setMensagemForm({
      nome: msg.nome,
      tipo_dor_id: msg.tipo_dor_id,
      conteudo: msg.conteudo,
      tipo_midia: msg.tipo_midia,
      midia_url: msg.midia_url || '',
      ativo: msg.ativo,
    });
    setError('');
    setShowMensagemModal(true);
  };

  const handleSubmitMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mensagemForm.nome.trim() || !mensagemForm.conteudo.trim()) {
      setError('Nome e conteudo sao obrigatorios');
      return;
    }
    
    setSaving(true);
    setError('');
    
    let result;
    if (editingMensagem) {
      result = await updateMensagem(editingMensagem.id, mensagemForm);
    } else {
      result = await createMensagem(mensagemForm);
    }
    
    if (result.success) {
      setShowMensagemModal(false);
      loadData();
    } else {
      setError(result.error || 'Erro ao salvar');
    }
    
    setSaving(false);
  };

  const handleDeleteMensagem = async (msg: RemarketingMensagem) => {
    if (!confirm(`Excluir mensagem "${msg.nome}"?`)) return;
    await deleteMensagem(msg.id);
    loadData();
  };

  const insertVariable = (varKey: string) => {
    setMensagemForm({
      ...mensagemForm,
      conteudo: mensagemForm.conteudo + `{{${varKey}}}`,
    });
  };

  // === TIPOS DE DOR ===
  const openCreateTipoDor = () => {
    setEditingTipoDor(null);
    setTipoDorForm({ nome: '', descricao: '', icone: '', ativo: true });
    setError('');
    setShowTipoDorModal(true);
  };

  const openEditTipoDor = (tipo: RemarketingTipoDor) => {
    setEditingTipoDor(tipo);
    setTipoDorForm({
      nome: tipo.nome,
      descricao: tipo.descricao || '',
      icone: tipo.icone || '',
      ativo: tipo.ativo,
    });
    setError('');
    setShowTipoDorModal(true);
  };

  const handleSubmitTipoDor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tipoDorForm.nome.trim()) {
      setError('Nome e obrigatorio');
      return;
    }
    
    setSaving(true);
    setError('');
    
    let result;
    if (editingTipoDor) {
      result = await updateTipoDor(editingTipoDor.id, tipoDorForm);
    } else {
      result = await createTipoDor(tipoDorForm);
    }
    
    if (result.success) {
      setShowTipoDorModal(false);
      loadData();
    } else {
      setError(result.error || 'Erro ao salvar');
    }
    
    setSaving(false);
  };

  const handleDeleteTipoDor = async (tipo: RemarketingTipoDor) => {
    if (!confirm(`Excluir tipo de dor "${tipo.nome}"?`)) return;
    await deleteTipoDor(tipo.id);
    loadData();
  };

  // === COMBINACOES ===
  const handleAddCombinacao = async () => {
    if (!combinacaoForm.categoria_id || !combinacaoForm.tipo_dor_id || !combinacaoForm.mensagem_id) {
      return;
    }
    
    await createCombinacao({
      categoria_id: combinacaoForm.categoria_id,
      tipo_dor_id: combinacaoForm.tipo_dor_id,
      mensagem_id: combinacaoForm.mensagem_id,
    });
    
    setCombinacaoForm({ categoria_id: null, tipo_dor_id: null, mensagem_id: null });
    loadData();
  };

  const handleDeleteCombinacao = async (id: number) => {
    await deleteCombinacao(id);
    loadData();
  };

  const getMidiaIcon = (tipo: string) => {
    const found = TIPOS_MIDIA.find(t => t.value === tipo);
    return found?.icon || MessageSquare;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Mensagens</h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            Templates de mensagem e tipos de dor
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#1e3a5f] pb-4">
        <button
          onClick={openCreateMensagem}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-all text-sm"
        >
          <Plus className="size-4" />
          Nova Mensagem
        </button>
        <button
          onClick={openCreateTipoDor}
          className="flex items-center gap-2 bg-[#162438] hover:bg-[#1e3a5f] text-white px-4 py-2 rounded-lg font-medium transition-all text-sm"
        >
          <Plus className="size-4" />
          Novo Tipo de Dor
        </button>
        <button
          onClick={() => setShowCombinacoesModal(true)}
          className="flex items-center gap-2 bg-[#162438] hover:bg-[#1e3a5f] text-white px-4 py-2 rounded-lg font-medium transition-all text-sm"
        >
          <Link2 className="size-4" />
          Combinacoes
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tipos de Dor */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-white mb-4">Tipos de Dor</h2>
            <div className="space-y-2">
              {tiposDor.length === 0 ? (
                <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-4 text-center text-slate-400">
                  Nenhum tipo cadastrado
                </div>
              ) : (
                tiposDor.map((tipo) => (
                  <div
                    key={tipo.id}
                    className={cn(
                      "bg-[#0f1f35] border border-[#1e3a5f] rounded-lg p-3 flex items-center justify-between",
                      !tipo.ativo && "opacity-50"
                    )}
                  >
                    <span className="text-white">{tipo.nome}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditTipoDor(tipo)}
                        className="p-1.5 hover:bg-[#1e3a5f] rounded text-slate-400 hover:text-white"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTipoDor(tipo)}
                        className="p-1.5 hover:bg-red-500/10 rounded text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mensagens */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-4">Templates de Mensagem</h2>
            <div className="space-y-3">
              {mensagens.length === 0 ? (
                <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-8 text-center text-slate-400">
                  <MessageSquare className="size-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma mensagem cadastrada</p>
                </div>
              ) : (
                mensagens.map((msg) => {
                  const MidiaIcon = getMidiaIcon(msg.tipo_midia);
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-4",
                        !msg.ativo && "opacity-50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-[#162438] rounded-lg">
                          <MidiaIcon className="size-5 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">{msg.nome}</p>
                            {msg.tipo_dor_nome && (
                              <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400">
                                {msg.tipo_dor_nome}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                            {msg.conteudo}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditMensagem(msg)}
                            className="p-2 hover:bg-[#1e3a5f] rounded-lg text-slate-400 hover:text-white"
                          >
                            <Edit2 className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMensagem(msg)}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400"
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
          </div>
        </div>
      )}

      {/* Modal Mensagem */}
      {showMensagemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <h2 className="text-xl font-bold text-white">
                {editingMensagem ? 'Editar Mensagem' : 'Nova Mensagem'}
              </h2>
              <button onClick={() => setShowMensagemModal(false)} className="text-slate-400 hover:text-white">
                <X className="size-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitMensagem} className="p-6 space-y-4">
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
                  value={mensagemForm.nome}
                  onChange={(e) => setMensagemForm({ ...mensagemForm, nome: e.target.value })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                  placeholder="Ex: Saudade - 30 dias"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Dor</label>
                <select
                  value={mensagemForm.tipo_dor_id || ''}
                  onChange={(e) => setMensagemForm({ ...mensagemForm, tipo_dor_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Nenhum (generico)</option>
                  {tiposDor.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Midia</label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_MIDIA.map((tipo) => (
                    <button
                      key={tipo.value}
                      type="button"
                      onClick={() => setMensagemForm({ ...mensagemForm, tipo_midia: tipo.value })}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                        mensagemForm.tipo_midia === tipo.value
                          ? "bg-orange-500/10 border-orange-500 text-orange-400"
                          : "bg-[#0a1628] border-[#1e3a5f] text-slate-400 hover:text-white"
                      )}
                    >
                      <tipo.icon className="size-4" />
                      <span className="text-sm">{tipo.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {mensagemForm.tipo_midia !== 'texto' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">URL da Midia</label>
                  <input
                    type="text"
                    value={mensagemForm.midia_url}
                    onChange={(e) => setMensagemForm({ ...mensagemForm, midia_url: e.target.value })}
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                    placeholder="https://..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Conteudo *</label>
                <textarea
                  value={mensagemForm.conteudo}
                  onChange={(e) => setMensagemForm({ ...mensagemForm, conteudo: e.target.value })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 resize-none"
                  rows={5}
                  placeholder="Ola {{nome}}, sentimos sua falta..."
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {VARIAVEIS.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      className="px-2 py-1 text-xs bg-[#162438] hover:bg-[#1e3a5f] text-slate-400 rounded transition-colors"
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMensagemModal(false)}
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

      {/* Modal Tipo de Dor */}
      {showTipoDorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <h2 className="text-xl font-bold text-white">
                {editingTipoDor ? 'Editar Tipo de Dor' : 'Novo Tipo de Dor'}
              </h2>
              <button onClick={() => setShowTipoDorModal(false)} className="text-slate-400 hover:text-white">
                <X className="size-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitTipoDor} className="p-6 space-y-4">
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
                  value={tipoDorForm.nome}
                  onChange={(e) => setTipoDorForm({ ...tipoDorForm, nome: e.target.value })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                  placeholder="Ex: Saudade, Oferta, Novidade..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Descricao</label>
                <textarea
                  value={tipoDorForm.descricao}
                  onChange={(e) => setTipoDorForm({ ...tipoDorForm, descricao: e.target.value })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 resize-none"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTipoDorModal(false)}
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

      {/* Modal Combinacoes */}
      {showCombinacoesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#1e3a5f]">
              <h2 className="text-xl font-bold text-white">Combinacoes</h2>
              <button onClick={() => setShowCombinacoesModal(false)} className="text-slate-400 hover:text-white">
                <X className="size-6" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Add new */}
              <div className="bg-[#0a1628] rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-3">Adicionar nova combinacao:</p>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={combinacaoForm.categoria_id || ''}
                    onChange={(e) => setCombinacaoForm({ ...combinacaoForm, categoria_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="bg-[#162438] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  >
                    <option value="">Categoria</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                  <select
                    value={combinacaoForm.tipo_dor_id || ''}
                    onChange={(e) => setCombinacaoForm({ ...combinacaoForm, tipo_dor_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="bg-[#162438] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  >
                    <option value="">Tipo de Dor</option>
                    {tiposDor.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                  <select
                    value={combinacaoForm.mensagem_id || ''}
                    onChange={(e) => setCombinacaoForm({ ...combinacaoForm, mensagem_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="bg-[#162438] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  >
                    <option value="">Mensagem</option>
                    {mensagens.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAddCombinacao}
                  disabled={!combinacaoForm.categoria_id || !combinacaoForm.tipo_dor_id || !combinacaoForm.mensagem_id}
                  className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                >
                  Adicionar
                </button>
              </div>

              {/* List */}
              <div className="space-y-2">
                {combinacoes.length === 0 ? (
                  <p className="text-center text-slate-400 py-4">Nenhuma combinacao cadastrada</p>
                ) : (
                  combinacoes.map((comb) => (
                    <div
                      key={comb.id}
                      className="bg-[#162438] rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">{comb.categoria_nome}</span>
                        <span className="text-slate-500">+</span>
                        <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400">{comb.tipo_dor_nome}</span>
                        <span className="text-slate-500">=</span>
                        <span className="text-white">{comb.mensagem_nome}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteCombinacao(comb.id)}
                        className="p-1.5 hover:bg-red-500/10 rounded text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
