#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# SCRIPT PARA RESOLVER O ERRO DE SERVER ACTIONS NO ZAPFLOW
# ═══════════════════════════════════════════════════════════════

echo "🔧 Iniciando limpeza e rebuild do projeto..."
echo ""

# 1. Limpar cache Next.js
echo "1️⃣  Limpando cache Next.js..."
rm -rf .next
rm -rf .turbo
rm -rf node_modules/.cache
echo "   ✅ Cache limpo"
echo ""

# 2. Limpar arquivos temporários de build
echo "2️⃣  Limpando arquivos temporários..."
find . -name "*.tsbuildinfo" -type f -delete
echo "   ✅ Arquivos temporários removidos"
echo ""

# 3. Reinstalar dependências (opcional, mas recomendado)
echo "3️⃣  Verificando dependências..."
npm install --legacy-peer-deps
echo "   ✅ Dependências verificadas"
echo ""

# 4. Executar build
echo "4️⃣  Executando build completo..."
npm run build
echo "   ✅ Build concluído"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "✨ Limpeza concluída!"
echo ""
echo "Próximos passos:"
echo "1. Execute: npm run dev"
echo "2. Abra o navegador em: http://localhost:3000"
echo "3. Se o erro persistir, execute: npm run clean && npm install && npm run dev"
echo "═══════════════════════════════════════════════════════════════"
