// Helper de impressão térmica (58mm / 80mm) via window.print
//
// Por que existe: impressoras térmicas não têm tons de cinza — ou queimam o
// ponto (preto) ou não queimam. Fonte fina com antialiasing sai cinza/borrada.
// Estratégia para um ticket nítido E bonito:
//   1) Preto puro (#000) + antialiasing desligado.
//   2) Fonte monospace em negrito, tamanho generoso (queima mais ponto).
//   3) BLOCOS INVERTIDOS (fundo preto, texto branco): a térmica queima o bloco
//      sólido inteiro -> fica lindo e legível. Usado no cabeçalho, badges e TOTAL.
//   4) Linhas-guia pontilhadas alinhando item <-> preço (leader dots).
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

  return `
  .zf-receipt {
    color: #000;
    background: #fff;
    font-family: 'Courier New', Courier, monospace;
    font-size: ${base}px;
    font-weight: 700;
    line-height: 1.32;
    -webkit-font-smoothing: none;
    -moz-osx-font-smoothing: grayscale;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .zf-receipt * { color: #000; box-sizing: border-box; }

  /* Cabeçalho invertido */
  .zf-brand { background:#000; color:#fff !important; text-align:center; padding:9px 6px; margin-bottom:8px; letter-spacing:1px; }
  .zf-brand * { color:#fff !important; }
  .zf-brand .zf-name { font-size:${heading}px; font-weight:900; line-height:1.1; }
  .zf-brand .zf-sub { font-size:${base}px; font-weight:700; margin-top:2px; }

  /* Badge de tipo */
  .zf-badge-wrap { text-align:center; margin:2px 0 9px; }
  .zf-badge { display:inline-block; background:#000; color:#fff !important; font-size:${base + 1}px; font-weight:900; padding:4px 14px; letter-spacing:3px; border-radius:2px; }

  /* Número grande (pedido/mesa) */
  .zf-bignum { text-align:center; font-size:${heading + 4}px; font-weight:900; line-height:1; margin:2px 0; }
  .zf-bignum-label { text-align:center; font-size:${base - 1}px; font-weight:700; letter-spacing:2px; }

  /* Seções */
  .zf-section { font-size:${base + 1}px; font-weight:900; letter-spacing:1px; margin:7px 0 3px; text-transform:uppercase; }

  /* Meta (label + valor) */
  .zf-meta { font-size:${base}px; margin:2px 0; word-break:break-word; }
  .zf-meta b { font-weight:900; }

  /* Item: quantidade + nome (pode quebrar) à esquerda, preço fixo à direita no topo */
  .zf-li { display:flex; align-items:flex-start; justify-content:space-between; gap:6px; margin:5px 0; }
  .zf-li .zf-nm { font-weight:800; flex:1; }
  .zf-li .zf-pr { font-weight:900; white-space:nowrap; text-align:right; }
  .zf-qbox { display:inline-block; min-width:24px; text-align:center; background:#000; color:#fff !important; font-weight:900; padding:0 4px; margin-right:6px; border-radius:2px; }
  .zf-obs { font-size:${base - 2}px; font-style:italic; margin:0 0 4px 30px; }

  /* Linhas de subtotal */
  .zf-row { display:flex; justify-content:space-between; font-size:${base}px; margin:3px 0; }
  .zf-row.zf-strong { font-weight:900; }

  /* Caixa do TOTAL invertida */
  .zf-total { background:#000; color:#fff !important; display:flex; justify-content:space-between; align-items:center; font-size:${total}px; font-weight:900; padding:8px 11px; margin:9px 0; letter-spacing:1px; border-radius:2px; }
  .zf-total * { color:#fff !important; }

  /* Divisores */
  .zf-dash { border:0; border-top:2px dashed #000; margin:8px 0; }
  .zf-solid { border:0; border-top:3px solid #000; margin:8px 0; }

  /* Rodapé */
  .zf-foot { text-align:center; font-size:${base - 1}px; margin-top:10px; }
  .zf-foot .zf-thanks { font-size:${base + 2}px; font-weight:900; margin-bottom:3px; }
  .zf-cut { text-align:center; font-size:${base - 3}px; letter-spacing:4px; margin-top:8px; opacity:0.85; }
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
