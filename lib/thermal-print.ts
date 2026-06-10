// Helper de impressão térmica (ESC/POS via navegador / window.print)
//
// Por que existe: impressoras térmicas (58mm / 80mm) não têm tons de cinza —
// ou queimam o ponto (preto) ou não queimam. Quando o navegador rasteriza uma
// fonte fina com antialiasing, sai aquele texto cinza/borrado. A solução é:
//   1) Forçar preto puro (#000) e desligar o antialiasing.
//   2) Usar fonte monospace em NEGRITO e tamanho maior (queima mais ponto).
//   3) Definir a largura correta do papel (58mm = 384 dots, 80mm = 576 dots).
//   4) Zerar as margens da página (@page) pra não cortar conteúdo.
//   5) Mapear as classes do Tailwind usadas no preview para CSS real, já que
//      a janela de impressão NÃO carrega o Tailwind.

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

interface BuildDocOptions {
  title: string;
  bodyHtml: string;
  largura: LarguraPapel;
}

export function buildThermalDoc({ title, bodyHtml, largura }: BuildDocOptions): string {
  // 58mm: ~32 colunas. 80mm: ~48 colunas. Fonte maior em 80mm.
  const is58 = largura === '58mm';
  const fontSize = is58 ? 16 : 17;
  const headingSize = is58 ? 21 : 24;
  const totalSize = is58 ? 22 : 26;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @page { size: ${largura} auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${largura};
    color: #000 !important;
    background: #fff;
    font-family: 'Courier New', Courier, monospace;
    font-size: ${fontSize}px;
    font-weight: 700;           /* negrito queima mais ponto = mais nítido */
    line-height: 1.3;
    -webkit-font-smoothing: none;        /* desliga antialiasing (cinza) */
    -moz-osx-font-smoothing: grayscale;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    text-rendering: optimizeLegibility;
  }
  body { padding: 4px 6px; }

  /* Tudo preto puro, sem cinza */
  *, strong, span, p, div, h1, h2, h3 { color: #000 !important; }

  /* --- Tipografia --- */
  h1 { font-size: ${headingSize}px; font-weight: 800; text-align: center; }
  h2 { font-size: ${fontSize + 2}px; font-weight: 800; text-align: center; }
  strong, .font-bold { font-weight: 800 !important; }
  .italic { font-style: italic; }

  /* --- Mapeamento das classes Tailwind usadas no preview --- */
  .text-center { text-align: center; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  .flex-1 { flex: 1; }
  .text-lg { font-size: ${headingSize}px; font-weight: 800; }
  .text-sm { font-size: ${fontSize}px; }
  .text-xs { font-size: ${fontSize - 2}px; }
  .text-\\[10px\\] { font-size: ${fontSize - 3}px; }

  /* Espaçamentos */
  .mb-2 { margin-bottom: 6px; } .mb-4 { margin-bottom: 10px; }
  .mt-1 { margin-top: 3px; } .mt-2 { margin-top: 6px; }
  .mt-4 { margin-top: 10px; } .mt-6 { margin-top: 14px; }
  .my-2 { margin: 6px 0; } .my-3 { margin: 9px 0; }
  .py-1 { padding: 3px 0; } .py-2 { padding: 6px 0; }
  .pt-2 { padding-top: 6px; } .pt-3 { padding-top: 9px; }
  .ml-4 { margin-left: 12px; }

  /* Bordas tracejadas/sólidas pretas */
  .border-t, .border-b,
  .border-t-2 { border-color: #000 !important; }
  .border-dashed { border-style: dashed !important; }
  .border-t { border-top: 1px dashed #000; }
  .border-b { border-bottom: 1px dashed #000; }
  .border-t-2 { border-top: 2px solid #000; }

  /* O TOTAL precisa saltar aos olhos */
  .total-line { font-size: ${totalSize}px; font-weight: 900; }
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
