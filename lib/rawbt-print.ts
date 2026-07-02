// Impressão térmica pelo CELULAR (Android) via app RawBT.
//
// Por que isso existe: no celular, window.print() NÃO fala com térmicas ESC/POS
// ligadas por cabo USB (o Chrome só enxerga impressoras Wi-Fi/nuvem). O padrão
// no Brasil é o app RawBT (grátis na Play Store), que instala como driver de
// impressão e conversa com a térmica pelo cabo/Bluetooth.
//
// Integração: o RawBT recebe conteúdo por um "URL scheme". O conteúdo precisa
// ir em BASE64 (não texto cru) — enviar texto puro url-encoded faz o app abrir
// mas NÃO imprimir. Enviamos o cupom em TEXTO PURO codificado em base64 UTF-8:
//
//   rawbt:data:text/plain;base64,{BASE64}
//
// Como fallback, também há a variante por intent (melhor p/ redirecionar à
// Play Store quando o app não está instalado):
//
//   intent:base64,{BASE64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;
//
// Referência: documentação do esquema rawbt: (a402d / RawBT).

import type { LarguraPapel } from '@/lib/thermal-print';

export const RAWBT_PACKAGE = 'ru.a402d.rawbtprinter';

// Largura em COLUNAS (caracteres monospace) por tipo de papel.
// 58mm ~ 32 colunas | 80mm ~ 48 colunas (fonte padrão).
function colunas(largura: LarguraPapel): number {
  return largura === '80mm' ? 48 : 32;
}

// ---- Helpers de layout em texto monospace ----

function normaliza(txt: string): string {
  // RawBT lida melhor sem acentos em algumas fontes/impressoras antigas.
  // Mantém legível e evita "?" ou caracteres quebrados no cupom.
  return (txt ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function centro(txt: string, largura: number): string {
  const s = normaliza(txt).slice(0, largura);
  const espacos = Math.max(0, Math.floor((largura - s.length) / 2));
  return ' '.repeat(espacos) + s;
}

function linha(largura: number, char = '-'): string {
  return char.repeat(largura);
}

// Duas colunas: rótulo à esquerda, valor à direita, preenchendo com espaços.
function duasColunas(esq: string, dir: string, largura: number): string {
  const e = normaliza(esq);
  const d = normaliza(dir);
  const espaco = Math.max(1, largura - e.length - d.length);
  if (e.length + d.length + 1 > largura) {
    // Não cabe em uma linha: quebra em duas.
    return `${e}\n${' '.repeat(Math.max(0, largura - d.length))}${d}`;
  }
  return e + ' '.repeat(espaco) + d;
}

// Quebra um texto longo em várias linhas respeitando a largura.
function quebra(txt: string, largura: number, prefixo = ''): string {
  const palavras = normaliza(txt).split(/\s+/);
  const linhas: string[] = [];
  let atual = prefixo;
  for (const p of palavras) {
    if ((atual + (atual === prefixo ? '' : ' ') + p).length > largura) {
      if (atual.trim()) linhas.push(atual);
      atual = prefixo + p;
    } else {
      atual += (atual === prefixo ? '' : ' ') + p;
    }
  }
  if (atual.trim()) linhas.push(atual);
  return linhas.join('\n');
}

const money = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

export interface ReciboItem {
  nome: string;
  qtd: number;
  preco: number;
  observacao?: string;
}

export interface ReciboDados {
  empresaNome?: string;
  pedidoId?: string | number;
  isDelivery?: boolean;
  clienteNome?: string;
  clienteTelefone?: string;
  endereco?: string;
  bairro?: string;
  itens: ReciboItem[];
  observacoes?: string;
  subtotal?: number;
  taxaEntrega?: number;
  desconto?: number;
  total?: number;
  formaPagamento?: string;
  troco?: number;
}

// Monta o cupom em texto puro, formatado por colunas para a largura do papel.
export function buildReceiptText(dados: ReciboDados, largura: LarguraPapel): string {
  const W = colunas(largura);
  const out: string[] = [];

  // Cabeçalho
  out.push(centro((dados.empresaNome || 'PEDIDO').toUpperCase(), W));
  out.push(centro(new Date().toLocaleString('pt-BR'), W));
  out.push('');
  out.push(centro(dados.isDelivery ? '* DELIVERY *' : '* RETIRADA *', W));
  out.push('');
  out.push(centro('PEDIDO', W));
  out.push(centro(`#${dados.pedidoId ?? ''}`, W));
  out.push(linha(W));

  // Cliente
  out.push(centro('CLIENTE', W));
  out.push(quebra(`Nome: ${dados.clienteNome || 'Cliente'}`, W));
  out.push(quebra(`Tel: ${dados.clienteTelefone || '-'}`, W));
  if (dados.isDelivery) {
    const end = `${dados.endereco || ''}${dados.bairro ? ` - ${dados.bairro}` : ''}`;
    out.push(quebra(`End: ${end}`, W));
  } else {
    out.push('Retirada no balcao');
  }
  out.push(linha(W));

  // Itens
  out.push(centro('ITENS', W));
  for (const item of dados.itens) {
    const qtd = `${item.qtd}x `;
    const preco = money(item.preco * item.qtd);
    // linha do item: "2x Nome do produto .... R$ 00,00"
    const nomeLargura = W - preco.length - 1;
    const nomeQuebrado = quebra(`${qtd}${item.nome}`, nomeLargura);
    const linhasNome = nomeQuebrado.split('\n');
    // coloca o preço à direita da primeira linha
    linhasNome[0] = duasColunas(linhasNome[0], preco, W);
    out.push(linhasNome.join('\n'));
    if (item.observacao) {
      out.push(quebra(`  > ${item.observacao}`, W, '  '));
    }
  }

  if (dados.observacoes) {
    out.push(linha(W));
    out.push(centro('OBSERVACOES', W));
    out.push(quebra(dados.observacoes, W));
  }

  out.push(linha(W));

  // Totais
  out.push(duasColunas('Subtotal', money(dados.subtotal ?? dados.total ?? 0), W));
  if (dados.taxaEntrega && dados.taxaEntrega > 0) {
    out.push(duasColunas('Entrega', money(dados.taxaEntrega), W));
  }
  if (dados.desconto && dados.desconto > 0) {
    out.push(duasColunas('Desconto', `-${money(dados.desconto)}`, W));
  }
  out.push(linha(W, '='));
  out.push(duasColunas('TOTAL', money(dados.total ?? 0), W));
  out.push(linha(W, '='));

  // Pagamento
  out.push(quebra(`Pagamento: ${dados.formaPagamento || 'Nao informado'}`, W));
  if (dados.formaPagamento === 'dinheiro' && dados.troco) {
    out.push(quebra(`Troco para: ${money(dados.troco)}`, W));
  }

  // Rodapé
  out.push('');
  out.push(centro('Obrigado pela preferencia!', W));
  out.push('');
  out.push(centro('powered by zapflow', W));
  // Avanço de papel para facilitar o corte.
  out.push('\n\n\n');

  return out.join('\n');
}

// ---- Conta de mesa / comanda ----

export interface ReciboComanda {
  nome: string;
  itens: ReciboItem[];
  subtotal: number;
}

export interface ReciboMesa {
  tipo: 'mesa' | 'comanda';
  mesaNumero?: string | number;
  mesaNome?: string;
  comandas: ReciboComanda[];
  total: number;
}

// Monta a conta de mesa/comanda em texto puro (mesmo layout do preview).
export function buildTableReceiptText(dados: ReciboMesa, largura: LarguraPapel): string {
  const W = colunas(largura);
  const out: string[] = [];

  // Cabeçalho
  const titulo = dados.tipo === 'mesa' ? `MESA ${dados.mesaNumero ?? ''}`.trim() : 'COMANDA';
  out.push(centro(titulo, W));
  out.push(centro(new Date().toLocaleString('pt-BR'), W));
  out.push('');
  out.push(centro(dados.tipo === 'mesa' ? '* CONTA DA MESA *' : '* CONTA INDIVIDUAL *', W));
  if (dados.mesaNome && dados.tipo === 'mesa') {
    out.push(centro(dados.mesaNome, W));
  }
  out.push(linha(W));

  // Itens agrupados por comanda
  const varias = dados.comandas.length > 1;
  dados.comandas.forEach((cmd, idx) => {
    out.push(normaliza(cmd.nome));
    if (cmd.itens.length > 0) {
      for (const item of cmd.itens) {
        const preco = money(item.preco * item.qtd);
        const nomeLargura = W - preco.length - 1;
        const linhasNome = quebra(`${item.qtd}x ${item.nome}`, nomeLargura).split('\n');
        linhasNome[0] = duasColunas(linhasNome[0], preco, W);
        out.push(linhasNome.join('\n'));
      }
      out.push(duasColunas('Subtotal', money(cmd.subtotal), W));
    } else {
      out.push('Nenhum item');
    }
    if (varias && idx < dados.comandas.length - 1) out.push(linha(W));
  });

  // Total geral
  out.push(linha(W, '='));
  out.push(duasColunas('TOTAL', money(dados.total), W));
  out.push(linha(W, '='));

  // Rodapé
  out.push('');
  out.push(centro('Obrigado pela preferencia!', W));
  out.push('');
  out.push(centro('powered by zapflow', W));
  out.push('\n\n\n');

  return out.join('\n');
}

// Codifica uma string em base64 de forma segura para UTF-8.
// (btoa sozinho quebra com caracteres fora do Latin1.)
function toBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Comando ESC/POS de corte de papel. RawBT interpreta os bytes de controle
// embutidos no conteúdo. Todos os bytes são < 0x80, então o TextEncoder os
// codifica como 1 byte cada (o RawBT recebe exatamente a sequência ESC/POS).
//   GS V B n  (0x1D 0x56 0x42 n) => avança n pontos e faz corte total.
// Impressoras sem guilhotina simplesmente ignoram o comando.
const CORTE_ESCPOS = '\x1D\x56\x42\x00';

interface RawBTOpts {
  useIntent?: boolean; // variante por intent (redireciona à Play Store se ausente)
  cut?: boolean; // anexa o comando ESC/POS de corte (padrão true)
}

// Envia um texto já montado ao RawBT (base64 + corte opcional).
// Retorna false se não for um ambiente com window (ex.: SSR).
function enviarTextoRawBT(texto: string, opts?: RawBTOpts): boolean {
  if (typeof window === 'undefined') return false;
  const cortar = opts?.cut !== false; // corte ligado por padrão
  const conteudo = texto + (cortar ? CORTE_ESCPOS : '');
  const b64 = toBase64Utf8(conteudo);
  const url = opts?.useIntent
    ? `intent:base64,${b64}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};end;`
    : `rawbt:data:text/plain;base64,${b64}`;
  // Navega para o esquema — o Android entrega o conteúdo ao RawBT.
  window.location.href = url;
  return true;
}

// Dispara a impressão de um PEDIDO no app RawBT (Android).
export function printViaRawBT(
  dados: ReciboDados,
  largura: LarguraPapel,
  opts?: RawBTOpts
): boolean {
  return enviarTextoRawBT(buildReceiptText(dados, largura), opts);
}

// Dispara a impressão de uma CONTA DE MESA/COMANDA no app RawBT (Android).
export function printTableViaRawBT(
  dados: ReciboMesa,
  largura: LarguraPapel,
  opts?: RawBTOpts
): boolean {
  return enviarTextoRawBT(buildTableReceiptText(dados, largura), opts);
}

// Detecta Android (onde o RawBT funciona).
// ATENCAO: nao usar isto para BLOQUEAR a impressao. Com o "Site para computador"
// ligado no Chrome, o Android remove "Android" do userAgent e esta funcao passa
// a retornar false mesmo em um aparelho Android. Use apenas como dica.
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

// Detecta iOS (iPhone/iPad), unico ambiente onde o RawBT realmente nao funciona.
// Em iPadOS recente o userAgent parece Mac, entao tambem checamos touch + platform.
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ se apresenta como "Macintosh" mas tem tela sensivel ao toque.
  return /Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document;
}
