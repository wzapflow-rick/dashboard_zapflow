'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import {
  Share2,
  QrCode,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { motion } from 'motion/react';
import { getMe } from '@/app/actions/auth';

function toSlug(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function GrowthPage() {
  const [copied, setCopied] = React.useState(false);
  const [user, setUser] = useState<any>(null);
  const [menuUrl, setMenuUrl] = useState('');

  useEffect(() => {
    getMe().then((me) => {
      setUser(me);
      if (me?.nome) {
        const slug = toSlug(me.nome);
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        setMenuUrl(`${base}/menu/${slug}`);
      }
    });
  }, []);

  const copyLink = () => {
    if (menuUrl) navigator.clipboard.writeText(menuUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayUrl = menuUrl.replace(/^https?:\/\//, '');

  return (
    <SidebarProvider>
      <DashboardLayout>
        <div className="space-y-8">
          <header>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Divulgação & Cardápio Online</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Compartilhe seu cardápio digital e atraia mais clientes.</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Share Link */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="size-11 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <LinkIcon className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg dark:text-white">Seu Link do Cardápio</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Compartilhe nas redes sociais e no WhatsApp</p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-300 flex items-center truncate">
                  {displayUrl || 'Carregando...'}
                </div>
                <button
                  onClick={copyLink}
                  disabled={!menuUrl}
                  className="px-5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>

              <div className="flex gap-3">
                <a
                  href={menuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 font-bold rounded-xl hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-sm"
                >
                  <ExternalLink className="size-4" />
                  Visualizar Cardápio
                </a>
                <a
                  href={menuUrl ? `https://wa.me/?text=${encodeURIComponent(`🍽️ Veja nosso cardápio e faça seu pedido: ${menuUrl}`)}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all text-sm"
                >
                  <Share2 className="size-4" />
                  Compartilhar
                </a>
              </div>
            </motion.div>

            {/* QR Code */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-8 items-center"
            >
              <div className="size-44 bg-slate-50 dark:bg-slate-700 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 flex flex-col items-center justify-center gap-3 shrink-0">
                <QrCode className="size-24 text-slate-400 dark:text-slate-500" />
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium text-center px-2">QR Code do cardápio</p>
              </div>
              <div className="space-y-4 text-center md:text-left">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Smartphone className="size-5 text-violet-500 dark:text-violet-400" />
                  <h3 className="font-bold text-lg">QR Code para Mesas</h3>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  Imprima e coloque em suas mesas ou balcão para que clientes acessem seu cardápio instantaneamente pelo celular.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 rounded-lg">
                  💡 Em breve: geração e download do QR Code automático.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Dicas */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl p-8 text-white">
            <h3 className="font-bold text-xl mb-2">💡 Dicas para aumentar suas vendas</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {[
                { title: 'Instagram', tip: 'Coloque o link do cardápio na bio do seu perfil.' },
                { title: 'Status do WhatsApp', tip: 'Poste o link e uma foto de um produto todo dia.' },
                { title: 'Google Maps', tip: 'Adicione o link do cardápio no seu perfil do Google.' },
              ].map((d) => (
                <div key={d.title} className="bg-white/10 rounded-xl p-4">
                  <h4 className="font-bold mb-1">{d.title}</h4>
                  <p className="text-sm text-white/80">{d.tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </SidebarProvider>
  );
}
