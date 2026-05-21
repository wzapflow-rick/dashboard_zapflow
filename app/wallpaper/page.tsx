'use client';

import Image from 'next/image';

export default function WallpaperPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-white text-xl mb-4 font-medium">Wallpaper ZapFlow - iPhone 15</h1>
        <p className="text-gray-400 text-sm mb-6">Clique com botao direito na imagem e salve, ou tire screenshot</p>
        
        {/* Container do wallpaper - proporcao iPhone 15 */}
        <div 
          className="relative mx-auto overflow-hidden rounded-3xl border-4 border-gray-800"
          style={{ 
            width: '393px', 
            height: '852px',
            background: 'linear-gradient(135deg, #0A0F14 0%, #081D10 50%, #0A0F14 100%)'
          }}
        >
          {/* Efeitos de fundo */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Glow superior */}
            <div 
              className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20 blur-3xl"
              style={{ background: 'radial-gradient(circle, #7CFF6B 0%, transparent 70%)' }}
            />
            
            {/* Glow inferior */}
            <div 
              className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-15 blur-3xl"
              style={{ background: 'radial-gradient(circle, #22D15A 0%, transparent 70%)' }}
            />
            
            {/* Linhas de fluxo */}
            <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 393 852" preserveAspectRatio="none">
              <defs>
                <linearGradient id="flowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7CFF6B" stopOpacity="0" />
                  <stop offset="50%" stopColor="#7CFF6B" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#22D15A" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M-50 900 Q 100 700 200 500 T 450 100" stroke="url(#flowGrad)" strokeWidth="2" fill="none" />
              <path d="M-100 850 Q 80 650 180 450 T 500 50" stroke="url(#flowGrad)" strokeWidth="1.5" fill="none" />
              <path d="M0 950 Q 120 750 220 550 T 400 150" stroke="url(#flowGrad)" strokeWidth="1" fill="none" />
            </svg>

            {/* Particulas sutis */}
            <div className="absolute top-1/4 right-1/4 w-1 h-1 bg-[#7CFF6B] rounded-full opacity-60" />
            <div className="absolute top-1/3 right-1/3 w-0.5 h-0.5 bg-[#7CFF6B] rounded-full opacity-40" />
            <div className="absolute bottom-1/3 left-1/4 w-1 h-1 bg-[#22D15A] rounded-full opacity-50" />
            <div className="absolute bottom-1/4 left-1/3 w-0.5 h-0.5 bg-[#22D15A] rounded-full opacity-30" />
          </div>

          {/* Logo centralizada */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo%204.0-RwXQ9EjpkWR2Pw5nJkUfKxreW3lq7q.png"
              alt="ZapFlow Logo"
              width={280}
              height={100}
              className="drop-shadow-[0_0_30px_rgba(124,255,107,0.4)]"
              priority
            />
          </div>
        </div>

        {/* Instrucoes */}
        <div className="mt-6 text-gray-500 text-xs space-y-1">
          <p>Resolucao: 1179 x 2556 pixels (iPhone 15)</p>
          <p>Para melhor qualidade, abra em tela cheia (F11) e tire screenshot</p>
        </div>
      </div>
    </div>
  );
}
