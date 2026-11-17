import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Tree-shake bibliotecas grandes (icones e animacao) para reduzir o JS enviado ao cliente.
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion', 'recharts', 'date-fns'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'wzapflow.com.br',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.wzapflow.com.br',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  // Usa o SHA do commit quando disponivel; senao, o Next gera um ID unico por build.
  generateBuildId: async () => process.env.GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || null,
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';
    return [
      // Headers para assets estaticos - cache longo com revalidacao
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Arquivos de public/ (imagens, icones) - cache de 1 dia com revalidacao em segundo plano
      {
        source: '/:file*.:ext(png|jpg|jpeg|webp|avif|svg|ico|gif|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      // Paginas e APIs - sem cache para evitar problemas de Server Actions entre deploys
      {
        source: '/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|gif|woff2)$).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: isProduction ? 'max-age=31536000; includeSubDomains; preload' : 'max-age=0',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.gstatic.com https://sdk.mercadopago.com https://www.mercadopago.com.br https://vercel.live https://*.vercel.live",
              "style-src 'self' 'unsafe-inline' https://*.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://*.gstatic.com https://*.googleapis.com",
              "connect-src 'self' https://db.wzapflow.com.br https://*.evolution-api.com https://api.mercadopago.com https://*.mercadopago.com https://*.mercadolibre.com https://vercel.live https://*.vercel.live wss://*.vercel.live",
              "frame-src 'self' https://*.mercadopago.com.br https://*.mercadopago.com https://vercel.live",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
