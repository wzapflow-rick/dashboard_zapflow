// Helper de impressão térmica (58mm / 80mm) via window.print
//
// Por que existe: impressoras térmicas não têm tons de cinza — ou queimam o
// ponto (preto) ou não queimam. Fonte fina com antialiasing sai cinza/borrada.
//
// IMPORTANTE (feedback de campo): blocos pretos sólidos (fundo preto) NÃO
// imprimem bem em muitas térmicas — saem falhados, borrados ou "chapados".
// Por isso este layout é 100% "line art": só texto preto puro sobre branco e
// linhas finas (sólidas/pontilhadas) como divisórias. Inspirado em cupons de
// delivery (ex.: iFood): títulos centralizados, tabela de itens com colunas
// Qtd / Itens / Preço, e TOTAL destacado por linhas — nunca por preenchimento.
//
// Estratégia para um ticket nítido E legível:
//   1) Preto puro (#000) + antialiasing desligado.
//   2) Fonte monospace em negrito, tamanho generoso (queima mais ponto).
//   3) SEM fundos pretos — destaque via tamanho, negrito e linhas divisórias.
//   4) Tabela de itens alinhada por colunas (Qtd | Itens | Preço).
//   5) Largura correta (58mm / 80mm) e margens da página zeradas.
//
// O CSS do RECIBO (getReceiptCss) é auto-contido e embutido no próprio conteúdo
// via <style>, então ele estiliza IGUALMENTE o preview (no modal, com Tailwind)
// e a janela de impressão (sem Tailwind). buildThermalDoc só cuida da página.

export type LarguraPapel = '58mm' | '80mm';

export function getLarguraPadrao(): LarguraPapel {
  if (typeof window === 'undefined') return '58mm';
  const salvo = window.localStorage.getItem('zapflow_largura_impressora');
  return salvo === '80mm' ? '80mm' : '58mm';
}

export function setLarguraPadrao(largura: LarguraPapel) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('zapflow_largura_impressora', largura);
}

// CSS do recibo — auto-contido, escopado em .zf-receipt. Funciona no preview e na impressão.
export function getReceiptCss(largura: LarguraPapel): string {
  const is58 = largura === '58mm';
  const base = is58 ? 15 : 17;
  const heading = is58 ? 25 : 29;
  const total = is58 ? 21 : 25;

  const qtyCol = is58 ? 34 : 40;

  return `
  .zf-receipt {
    color: #000;
    background: #fff;
    font-family: 'Courier New', Courier, monospace;
    font-size: ${base}px;
    font-weight: 700;
    line-height: 1.34;
    -webkit-font-smoothing: none;
    -moz-osx-font-smoothing: grayscale;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .zf-receipt * { color: #000; box-sizing: border-box; }

  /* Cabeçalho: só texto centralizado, sem fundo preto */
  .zf-brand { text-align:center; padding:2px 4px 8px; margin-bottom:6px; border-bottom:2px solid #000; }
  .zf-brand .zf-name { font-size:${heading}px; font-weight:900; line-height:1.12; text-transform:uppercase; }
  .zf-brand .zf-sub { font-size:${base - 1}px; font-weight:700; margin-top:3px; }

  /* Tipo do pedido: texto forte centralizado (sem preenchimento) */
  .zf-badge-wrap { text-align:center; margin:8px 0 4px; }
  .zf-badge { display:inline-block; font-size:${base + 2}px; font-weight:900; letter-spacing:3px; text-transform:uppercase; }

  /* Número grande (pedido/mesa) */
  .zf-bignum-label { text-align:center; font-size:${base - 1}px; font-weight:700; letter-spacing:2px; text-transform:uppercase; }
  .zf-bignum { text-align:center; font-size:${heading + 6}px; font-weight:900; line-height:1; margin:1px 0 2px; }

  /* Títulos de seção: centralizados e em destaque (estilo cupom) */
  .zf-section { text-align:center; font-size:${base + 1}px; font-weight:900; letter-spacing:1px; margin:9px 0 4px; text-transform:uppercase; }

  /* Meta (label + valor) */
  .zf-meta { font-size:${base}px; margin:2px 0; word-break:break-word; }
  .zf-meta b { font-weight:900; }

  /* Tabela de itens: cabeçalho + linhas em colunas Qtd | Itens | Preço */
  .zf-ihead { display:flex; gap:6px; align-items:flex-end; font-size:${base - 1}px; font-weight:900; text-transform:uppercase; padding-bottom:3px; border-bottom:1px solid #000; margin-bottom:4px; }
  .zf-li { display:flex; align-items:flex-start; gap:6px; margin:5px 0; }
  .zf-q { width:${qtyCol}px; flex-shrink:0; font-weight:900; text-align:left; }
  .zf-nm { flex:1; font-weight:800; word-break:break-word; }
  .zf-pr { flex-shrink:0; font-weight:900; white-space:nowrap; text-align:right; }
  .zf-ihead .zf-nm { font-weight:900; }
  .zf-obs { font-size:${base - 2}px; font-style:italic; margin:1px 0 4px ${qtyCol + 6}px; }

  /* Linhas de subtotal */
  .zf-row { display:flex; justify-content:space-between; font-size:${base}px; margin:3px 0; }
  .zf-row.zf-strong { font-weight:900; }

  /* TOTAL: destaque por linhas (sem fundo preto) */
  .zf-total { display:flex; justify-content:space-between; align-items:center; font-size:${total}px; font-weight:900; padding:7px 2px; margin:8px 0; letter-spacing:1px; border-top:3px solid #000; border-bottom:3px solid #000; }

  /* Divisores */
  .zf-dash { border:0; border-top:2px dashed #000; margin:8px 0; }
  .zf-solid { border:0; border-top:3px solid #000; margin:8px 0; }

  /* Rodapé */
  .zf-foot { text-align:center; font-size:${base - 1}px; margin-top:10px; }
  .zf-foot .zf-thanks { font-size:${base + 2}px; font-weight:900; margin-bottom:3px; }
  .zf-cut { text-align:center; font-size:${base - 3}px; letter-spacing:4px; margin-top:8px; }
  /* Assinatura discreta no finalzinho do ticket */
  .zf-sign { text-align:center; font-size:${base - 4}px; font-weight:700; letter-spacing:1px; margin-top:6px; }
  .zf-center { text-align:center; }
  `;
}

interface BuildDocOptions {
  title: string;
  bodyHtml: string;
  largura: LarguraPapel;
}

export function buildThermalDoc({ title, bodyHtml, largura }: BuildDocOptions): string {
  // O bodyHtml já contém o <style> do recibo (getReceiptCss) embutido.
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @page { size: ${largura} auto; margin: 0; }
  * { margin: 0; padding: 0; }
  html, body {
    width: ${largura};
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body { padding: 6px 7px; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

// Dispara a impressão numa janela isolada com o CSS térmico aplicado.
export function printThermal(opts: BuildDocOptions) {
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    alert('Bloqueador de pop-ups impede a impressão. Permita pop-ups para este site.');
    return;
  }
  printWindow.document.write(buildThermalDoc(opts));
  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, 250);
}
