'use client';

import { useEffect, useState } from 'react';
import { 
  Settings, 
  Save,
  AlertCircle,
  Check,
  RefreshCw,
  Key,
  Clock,
  Calendar,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { 
  getConfig,
  saveConfig,
  type RemarketingConfig,
} from '@/app/actions/remarketing';
import { cn } from '@/lib/utils';

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sab' },
];

export default function ConfigPage() {
  const [config, setConfig] = useState<RemarketingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    instance_name: '',
    api_key_cron: '',
    horario_inicio: '08:00',
    horario_fim: '21:00',
    dias_semana: [1, 2, 3, 4, 5, 6] as number[],
    limite_por_hora: 60,
    limite_por_dia: 500,
    intervalo_segundos: 10,
    ativo: true,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const result = await getConfig();
    if (result.success && result.config) {
      setConfig(result.config);
      setFormData({
        instance_name: result.config.instance_name || '',
        api_key_cron: result.config.api_key_cron || '',
        horario_inicio: result.config.horario_inicio || '08:00',
        horario_fim: result.config.horario_fim || '21:00',
        dias_semana: result.config.dias_semana || [1, 2, 3, 4, 5, 6],
        limite_por_hora: result.config.limite_por_hora || 60,
        limite_por_dia: result.config.limite_por_dia || 500,
        intervalo_segundos: result.config.intervalo_segundos || 10,
        ativo: result.config.ativo ?? true,
      });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.api_key_cron.trim()) {
      setError('A chave API do cron e obrigatoria');
      return;
    }
    
    setSaving(true);
    setError('');
    setSuccess(false);
    
    const result = await saveConfig(formData);
    
    if (result.success) {
      setSuccess(true);
      setConfig(result.config || null);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Erro ao salvar');
    }
    
    setSaving(false);
  };

  const toggleDiaSemana = (dia: number) => {
    const newDias = formData.dias_semana.includes(dia)
      ? formData.dias_semana.filter(d => d !== dia)
      : [...formData.dias_semana, dia].sort();
    setFormData({ ...formData, dias_semana: newDias });
  };

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, api_key_cron: key });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Configuracoes</h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            Configure o sistema de remarketing
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 flex items-center gap-2">
            <AlertCircle className="size-5" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400 flex items-center gap-2">
            <Check className="size-5" />
            Configuracoes salvas com sucesso!
          </div>
        )}

        {/* Status */}
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                formData.ativo ? "bg-green-500/10" : "bg-red-500/10"
              )}>
                <Zap className={cn(
                  "size-6",
                  formData.ativo ? "text-green-400" : "text-red-400"
                )} />
              </div>
              <div>
                <p className="font-medium text-white">Sistema de Remarketing</p>
                <p className="text-sm text-slate-400">
                  {formData.ativo ? 'Ativo e processando' : 'Desativado'}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#1e3a5f] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>
        </div>

        {/* Evolution Instance */}
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="size-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Evolution API</h2>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nome da Instancia
            </label>
            <input
              type="text"
              value={formData.instance_name}
              onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })}
              className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
              placeholder="Ex: zapflow_123"
            />
            <p className="text-xs text-slate-500 mt-1">
              Nome da instancia Evolution para importar contatos e enviar mensagens
            </p>
          </div>
        </div>

        {/* API Key Cron */}
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Key className="size-5 text-orange-400" />
            <h2 className="text-lg font-semibold text-white">Autenticacao do Cron</h2>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Chave API *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.api_key_cron}
                onChange={(e) => setFormData({ ...formData, api_key_cron: e.target.value })}
                className="flex-1 bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500 font-mono text-sm"
                placeholder="Chave secreta para autenticar os endpoints"
              />
              <button
                type="button"
                onClick={generateApiKey}
                className="px-4 py-3 bg-[#162438] hover:bg-[#1e3a5f] text-white rounded-lg transition-colors"
              >
                <RefreshCw className="size-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Use no header: <code className="bg-[#0a1628] px-1 rounded">x-cron-key: SUA_CHAVE</code>
            </p>
          </div>
        </div>

        {/* Horarios */}
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="size-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Horarios de Envio</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Inicio
              </label>
              <input
                type="time"
                value={formData.horario_inicio}
                onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Fim
              </label>
              <input
                type="time"
                value={formData.horario_fim}
                onChange={(e) => setFormData({ ...formData, horario_fim: e.target.value })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Dias da Semana
            </label>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((dia) => (
                <button
                  key={dia.value}
                  type="button"
                  onClick={() => toggleDiaSemana(dia.value)}
                  className={cn(
                    "px-4 py-2 rounded-lg border transition-colors",
                    formData.dias_semana.includes(dia.value)
                      ? "bg-orange-500/10 border-orange-500 text-orange-400"
                      : "bg-[#0a1628] border-[#1e3a5f] text-slate-400 hover:text-white"
                  )}
                >
                  {dia.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Limites */}
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="size-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Limites de Envio</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Limite por Hora
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={formData.limite_por_hora}
                onChange={(e) => setFormData({ ...formData, limite_por_hora: parseInt(e.target.value) || 60 })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Limite por Dia
              </label>
              <input
                type="number"
                min="1"
                max="5000"
                value={formData.limite_por_dia}
                onChange={(e) => setFormData({ ...formData, limite_por_dia: parseInt(e.target.value) || 500 })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Intervalo (segundos)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={formData.intervalo_segundos}
                onChange={(e) => setFormData({ ...formData, intervalo_segundos: parseInt(e.target.value) || 10 })}
                className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Esses limites ajudam a evitar bloqueios do WhatsApp. Recomendamos nao exceder 60/hora e 500/dia.
          </p>
        </div>

        {/* Cron Examples */}
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Exemplo de Crontab</h2>
          <div className="bg-[#0a1628] rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto">
            <p className="text-slate-500"># Classificar contatos a cada 6 horas</p>
            <p>0 */6 * * * curl -X POST -H &quot;x-cron-key: {formData.api_key_cron || 'SUA_CHAVE'}&quot; https://seusite.com/api/cron/remarketing/classificar</p>
            <p className="mt-2 text-slate-500"># Agendar mensagens a cada hora</p>
            <p>0 * * * * curl -X POST -H &quot;x-cron-key: {formData.api_key_cron || 'SUA_CHAVE'}&quot; https://seusite.com/api/cron/remarketing/agendar</p>
            <p className="mt-2 text-slate-500"># Processar fila a cada 5 minutos</p>
            <p>*/5 * * * * curl -X POST -H &quot;x-cron-key: {formData.api_key_cron || 'SUA_CHAVE'}&quot; https://seusite.com/api/cron/remarketing/processar</p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="size-5 animate-spin" />
            ) : (
              <Save className="size-5" />
            )}
            <span>{saving ? 'Salvando...' : 'Salvar Configuracoes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
