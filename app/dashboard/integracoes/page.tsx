'use client';

import { useState, useEffect } from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import { 
  Link2, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink,
  Smartphone,
  ShoppingBag,
  MessageCircle,
  CreditCard,
  Webhook,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Plus
} from 'lucide-react';
import { getIntegrationStatus, regenerateWebhookToken } from '@/app/actions/integrations';

interface IntegrationStatus {
  whatsapp: {
    connected: boolean;
    instance: string | null;
  };
  mercadopago: {
    connected: boolean;
  };
  webhook: {
    token: string | null;
    url: string;
  };
}

// Logos dos apps de entrega
const DELIVERY_APPS = [
  { 
    id: 'ifood', 
    name: 'iFood', 
    color: '#EA1D2C',
    logo: '/images/integrations/ifood.png',
    description: 'Maior app de delivery do Brasil'
  },
  { 
    id: 'rappi', 
    name: 'Rappi', 
    color: '#FF441F',
    logo: '/images/integrations/rappi.png',
    description: 'Entregas rapidas na sua regiao'
  },
  { 
    id: '99food', 
    name: '99Food', 
    color: '#FFCC00',
    logo: '/images/integrations/99food.png',
    description: 'Delivery da 99'
  },
  { 
    id: 'aiqfome', 
    name: 'Aiqfome', 
    color: '#7B2D8E',
    logo: '/images/integrations/aiqfome.png',
    description: 'Popular no interior do Brasil'
  },
  { 
    id: 'ubereats', 
    name: 'Uber Eats', 
    color: '#06C167',
    logo: '/images/integrations/ubereats.png',
    description: 'Delivery global'
  },
];

export default function IntegracoesPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const data = await getIntegrationStatus();
      setStatus(data);
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
    setLoading(false);
  }

  async function handleRegenerateToken() {
    if (!confirm('Tem certeza? Isso invalidara o token atual e todas as integracoes precisarao ser atualizadas.')) {
      return;
    }
    
    setRegenerating(true);
    try {
      const newToken = await regenerateWebhookToken();
      setStatus(prev => prev ? { ...prev, webhook: { ...prev.webhook, token: newToken } } : null);
    } catch (error) {
      console.error('Erro ao regenerar token:', error);
      alert('Erro ao regenerar token');
    }
    setRegenerating(false);
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <SidebarProvider>
      <DashboardLayout>
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Integracoes
            </h1>
            <p className="text-gray-400">
              Conecte sua loja com apps de entrega e receba todos os pedidos em um so lugar.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="size-8 text-emerald-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Status das Conexoes */}
              <section>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Link2 className="size-5 text-emerald-500" />
                  Status das Conexoes
                </h2>
                
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* WhatsApp */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center justify-center size-10 rounded-lg bg-green-500/20">
                        <MessageCircle className="size-5 text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">WhatsApp</h3>
                        <p className="text-xs text-gray-400">Evolution API</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {status?.whatsapp.connected ? (
                        <>
                          <CheckCircle2 className="size-4 text-green-400" />
                          <span className="text-sm text-green-400">Conectado</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-4 text-red-400" />
                          <span className="text-sm text-red-400">Desconectado</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mercado Pago */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/20">
                        <CreditCard className="size-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">Mercado Pago</h3>
                        <p className="text-xs text-gray-400">Pagamentos PIX</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {status?.mercadopago.connected ? (
                        <>
                          <CheckCircle2 className="size-4 text-green-400" />
                          <span className="text-sm text-green-400">Configurado</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="size-4 text-yellow-400" />
                          <span className="text-sm text-yellow-400">Nao configurado</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Webhook */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center justify-center size-10 rounded-lg bg-purple-500/20">
                        <Webhook className="size-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">Webhook API</h3>
                        <p className="text-xs text-gray-400">Apps de Entrega</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {status?.webhook.token ? (
                        <>
                          <CheckCircle2 className="size-4 text-green-400" />
                          <span className="text-sm text-green-400">Token ativo</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="size-4 text-yellow-400" />
                          <span className="text-sm text-yellow-400">Gerar token</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Configuracao do Webhook */}
              <section>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Webhook className="size-5 text-purple-500" />
                  API de Integracoes
                </h2>

                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-6">
                    Use estas credenciais para integrar com iFood, Rappi, N8N, Zapier ou qualquer sistema externo.
                    Os pedidos aparecerao automaticamente no seu painel Kanban.
                  </p>

                  {/* URL do Webhook */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      URL do Webhook
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={status?.webhook.url || ''}
                        readOnly
                        className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm font-mono"
                      />
                      <button
                        onClick={() => copyToClipboard(status?.webhook.url || '', 'url')}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        {copied === 'url' ? (
                          <Check className="size-5 text-green-400" />
                        ) : (
                          <Copy className="size-5 text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Token */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Token de Autenticacao
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type={showToken ? 'text' : 'password'}
                          value={status?.webhook.token || 'Clique em "Gerar Token" para criar'}
                          readOnly
                          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm font-mono pr-10"
                        />
                        <button
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {status?.webhook.token && (
                        <button
                          onClick={() => copyToClipboard(status.webhook.token || '', 'token')}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          {copied === 'token' ? (
                            <Check className="size-5 text-green-400" />
                          ) : (
                            <Copy className="size-5 text-gray-300" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={handleRegenerateToken}
                        disabled={regenerating}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className={`size-4 text-white ${regenerating ? 'animate-spin' : ''}`} />
                        <span className="text-white text-sm hidden sm:inline">
                          {status?.webhook.token ? 'Regenerar' : 'Gerar Token'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Exemplo de Uso */}
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-300">Exemplo de requisicao</span>
                      <button
                        onClick={() => copyToClipboard(`curl -X POST "${status?.webhook.url}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "plataforma": "ifood",
    "pedido_externo_id": "ABC123",
    "empresa_token": "${status?.webhook.token || 'SEU_TOKEN_AQUI'}",
    "cliente_nome": "Joao Silva",
    "cliente_telefone": "11999999999",
    "itens": [{"nome": "Pizza Grande", "quantidade": 1, "preco_unitario": 45.90}],
    "subtotal": 45.90,
    "taxa_entrega": 5.00,
    "valor_total": 50.90,
    "tipo_pagamento": "pix",
    "tipo_entrega": "delivery"
  }'`, 'example')}
                        className="text-xs text-purple-400 hover:text-purple-300"
                      >
                        {copied === 'example' ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <pre className="text-xs text-gray-400 overflow-x-auto">
{`curl -X POST "${status?.webhook.url}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "plataforma": "ifood",
    "pedido_externo_id": "ABC123",
    "empresa_token": "${status?.webhook.token ? status.webhook.token.slice(0, 8) + '...' : 'SEU_TOKEN_AQUI'}",
    "cliente_nome": "Joao Silva",
    "itens": [...],
    "valor_total": 50.90
  }'`}
                    </pre>
                  </div>
                </div>
              </section>

              {/* Apps de Entrega */}
              <section>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <ShoppingBag className="size-5 text-orange-500" />
                  Apps de Entrega Suportados
                </h2>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {DELIVERY_APPS.map((app) => (
                    <div
                      key={app.id}
                      className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div 
                          className="flex items-center justify-center size-12 rounded-xl text-white font-bold text-lg"
                          style={{ backgroundColor: app.color + '20', color: app.color }}
                        >
                          {app.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{app.name}</h3>
                          <p className="text-xs text-gray-400">{app.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Via N8N ou Zapier
                        </span>
                        <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full">
                          Suportado
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Card para adicionar mais */}
                  <div className="bg-gray-800/30 border border-dashed border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center text-center min-h-[120px]">
                    <Plus className="size-8 text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500">
                      Precisa de outra integracao?
                    </p>
                    <a 
                      href="https://wa.me/5579998049790?text=Olá! Preciso de ajuda com integração no ZapFlow"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-400 hover:text-emerald-300 mt-1"
                    >
                      Fale conosco
                    </a>
                  </div>
                </div>
              </section>

              {/* Como Funciona */}
              <section>
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Smartphone className="size-5 text-blue-500" />
                  Como Funciona
                </h2>

                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <ol className="space-y-4">
                    <li className="flex gap-4">
                      <span className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                        1
                      </span>
                      <div>
                        <h4 className="font-medium text-white">Configure o N8N ou Zapier</h4>
                        <p className="text-sm text-gray-400">
                          Crie uma automacao que conecte o iFood/Rappi ao nosso webhook
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                        2
                      </span>
                      <div>
                        <h4 className="font-medium text-white">Use o Token de Autenticacao</h4>
                        <p className="text-sm text-gray-400">
                          Adicione o token no campo empresa_token de cada requisicao
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                        3
                      </span>
                      <div>
                        <h4 className="font-medium text-white">Receba os Pedidos</h4>
                        <p className="text-sm text-gray-400">
                          Os pedidos aparecem automaticamente no Kanban com a origem identificada
                        </p>
                      </div>
                    </li>
                  </ol>

                  <div className="mt-6 pt-4 border-t border-gray-700">
                    <a
                      href="https://docs.wzapflow.com.br/integracoes"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
                    >
                      Ver documentacao completa
                      <ExternalLink className="size-4" />
                    </a>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </DashboardLayout>
    </SidebarProvider>
  );
}
