'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { driverLogin } from '@/app/actions/driver-auth';

export default function DriverLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await driverLogin(email, password);
      
      if (result.success) {
        router.push('/driver');
        router.refresh();
      } else {
        setError(result.error || 'Erro ao fazer login');
      }
    } catch (err: any) {
      setError(err.message || 'Erro interno');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="size-20 bg-white rounded-2xl shadow-xl mx-auto mb-4 flex items-center justify-center">
            <Truck className="size-10 text-purple-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">ZapFlow Entregador</h1>
          <p className="text-white/80 mt-2">Acesse seu painel de entregas</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                <Mail className="size-4" />
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                <Lock className="size-4" />
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Use seu telefone como senha"
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
              />
              <p className="text-xs text-slate-400 mt-1">Sua senha é o número do seu WhatsApp (apenas números)</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a 
              href="/menu" 
              className="text-sm text-slate-500 hover:text-purple-500 transition-colors"
            >
              Voltar para o cardápio
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 text-sm mt-6">
          Precisa de ajuda? Fale com o administrador
        </p>
      </motion.div>
    </div>
  );
}
