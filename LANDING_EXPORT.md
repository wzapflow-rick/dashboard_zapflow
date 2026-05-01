# Exportacao da Landing Page ZapFlow

## Passo a passo para o novo projeto:

### 1. Criar projeto Next.js
```bash
npx create-next-app@latest landing-wzapflow --typescript --tailwind --eslint --app
cd landing-wzapflow
```

### 2. Instalar dependencias
```bash
npm install framer-motion lucide-react
```

### 3. Arquivos necessarios

Copie os seguintes arquivos deste projeto para o novo:

---

## Arquivo: app/page.tsx
Copie o conteudo de: `app/landing/page.tsx`

---

## Arquivo: app/layout.tsx
```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ZapFlow - Seu delivery com sabor de sucesso',
  description: 'Cardapio digital irresistivel, pedidos que chegam quentinhos e gestao que faz seu caixa transbordar.',
  keywords: 'delivery, cardapio digital, restaurante, pizzaria, hamburgueria, pedidos online',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body className={`${inter.className} bg-[#0a0a0a] antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

---

## Arquivo: app/globals.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}

body {
  background-color: #0a0a0a;
}

/* Scrollbar customizada */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
}

::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #444;
}
```

---

## Imagens necessarias (pasta public/images/):

1. **pizza-logo.png** - A pizza da logo (ja salva neste projeto)
2. **menu-screenshot.png** - Screenshot do cardapio (ja salva neste projeto)
3. **mascot-start.jpg** - Mascote do plano Start (ja gerada neste projeto)
4. **mascot-pro.jpg** - Mascote do plano PRO (ja gerada neste projeto)
5. **mascot-elite.jpg** - Mascote do plano ELITE (ja gerada neste projeto)

Copie todas as imagens de `public/images/` para o novo projeto.

---

## Links que precisam ser ajustados:

No arquivo page.tsx, ajuste os links conforme necessario:
- `https://cardapio.wzapflow.com.br` - Link para o dashboard/cadastro

---

## Estrutura final do novo projeto:
```
landing-wzapflow/
├── app/
│   ├── page.tsx (copiar de app/landing/page.tsx)
│   ├── layout.tsx
│   └── globals.css
├── public/
│   └── images/
│       ├── pizza-logo.png
│       ├── menu-screenshot.png
│       ├── mascot-start.jpg
│       ├── mascot-pro.jpg
│       └── mascot-elite.jpg
├── package.json
└── tailwind.config.ts
```
