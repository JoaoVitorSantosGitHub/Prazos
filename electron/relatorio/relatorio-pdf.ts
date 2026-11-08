import PDFDocument from 'pdfkit';
import { AniversarianteMontado } from './aniversarios';
import { Aparencia, APARENCIA_PADRAO, CoresRelatorio, misturar } from './aparencia';

// Layout do "Relatório de Vencimentos de Férias, Experiência e Afastamentos": faixa com o título, seções com bolinha
// colorida (vermelho = crítico, amarelo = regular, azul = contrato), cartões vermelhos pros críticos e tabela limpa pros
// regulares. As cores abaixo vêm da aparência escolhida pelo escritório (aplicarCores); os tons de fundo e de texto de
// cada uma são derivados dela. Elas são variáveis do módulo porque o PDF é desenhado de forma síncrona, de uma vez só.
let MARINHO = '#1E293B';
let AZUL = '#3B82F6';
let VERMELHO = '#EF4444';
let VERMELHO_ESCURO = '#B91C1C';
let VERMELHO_FUNDO = '#FEF2F2';
let AMARELO = '#F59E0B';
const CINZA_ESCURO = '#0F172A';
const TEXTO = '#334155';
const CINZA = '#64748B';
const LINHA = '#E2E8F0';
const TABELA_CABECALHO = '#F1F5F9';
let MENSAGEM_FUNDO = '#ECFDF5'; // verdinho de balão de WhatsApp
let MENSAGEM_BARRA = '#10B981';
let AZUL_FUNDO = '#EFF6FF';
let VERDE = '#22C55E';
let VERDE_FUNDO = '#F0FDF4';
let VERDE_TEXTO = '#166534';
let FAIXA_SUPERIOR = '#3B82F6';
let COR_SEGUNDO_PERIODO = '#14B8A6';
let COR_ANIVERSARIO = '#EC4899';
let COR_ANIVERSARIO_HOJE = '#BE185D';

function aplicarCores(c: CoresRelatorio) {
  COR_SEGUNDO_PERIODO = c.segundoPeriodo;
  COR_ANIVERSARIO = c.aniversario;
  COR_ANIVERSARIO_HOJE = misturar(c.aniversario, '#000000', 0.25);
  FAIXA_SUPERIOR = c.faixaSuperior;
  MARINHO = c.titulo;
  AZUL = c.destaque;
  AZUL_FUNDO = misturar(c.destaque, '#FFFFFF', 0.92);
  VERMELHO = c.critico;
  VERMELHO_ESCURO = misturar(c.critico, '#000000', 0.3);
  VERMELHO_FUNDO = misturar(c.critico, '#FFFFFF', 0.94);
  AMARELO = c.atencao;
  MENSAGEM_BARRA = c.mensagem;
  MENSAGEM_FUNDO = misturar(c.mensagem, '#FFFFFF', 0.92);
  VERDE = c.mensagem;
  VERDE_FUNDO = misturar(c.mensagem, '#FFFFFF', 0.94);
  VERDE_TEXTO = misturar(c.mensagem, '#000000', 0.55);
}

export function formatarCnpj(cnpj: string | null): string {
  if (!cnpj || cnpj.length !== 14) return cnpj || '—';
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export interface CriticoRelatorio {
  nome: string;
  diasPendentes: string;
  periodoEncerrado: string;
  prazoLimite: string;
  /** Dias até o prazo (negativo = já venceu). */
  faltam: number;
  /** Quando o colaborador completa o 2º período aquisitivo (fim do período + 1 ano). */
  segundoPeriodo: string | null;
}
export interface RegularRelatorio { nome: string; periodoEncerrado: string; prazoLimite: string; diasPendentes: string }
/** cao = o que fazer, já escrito conforme faltam poucos dias (ver acaoContrato no serviço). */
export interface ContratoRelatorio { nome: string; descricao: string; acao: string }
export interface AfastadoRelatorio { nome: string; motivo: string; inicio: string; retorno: string }
export interface SegundoPeriodoRelatorio { nome: string; vencimento: string; limite: string }

export interface DadosRelatorio {
  empresa: string;
  codiEmp: number;
  cnpj: string | null; // só dígitos
  emissao: string; // dd/mm/aaaa
  geradoEm: string; // "dd/mm/aaaa HH:mm"
  /** Texto do modelo (com *negrito* e _itálico_); null = nenhum modelo, o PDF segue só o layout padrão. */
  mensagem: string | null;
  totais: { rotulo: string; valor: number; urgente?: boolean }[];
  criticos: CriticoRelatorio[];
  regulares: RegularRelatorio[];
  contratos: ContratoRelatorio[];
  afastados: AfastadoRelatorio[];
  segundoPeriodo: SegundoPeriodoRelatorio[];
  /** Colaboradores que fazem aniversário no mês, por dia. */
  aniversariantes: AniversarianteMontado[];
  /** Telefone/WhatsApp do escritório pro quadro "Precisa de ajuda com esses dados?"; null = sem o quadro. */
  contatoAjuda: string | null;
}

const MARGEM = 40;

// Papel timbrado de TODAS as páginas, montado a partir da aparência escolhida: faixa fina no topo, logo no canto superior
// esquerdo, marca d'água ao centro e rodapé (imagem ou dois blocos de texto + barra). O conteúdo do relatório fica entre o
// cabeçalho e o rodapé (medidas em pt, A4 = 595 x 842). Os valores abaixo são recalculados a cada PDF (prepararFundo).
let TOPO_CONTEUDO = 92;
let FIM_CONTEUDO = 762;
const ALTURA_TOPO_PADRAO = 92;

interface Fundo {
  ap: Aparencia;
  logo?: { buf: Buffer; largura: number; altura: number };
  marca?: { buf: Buffer; largura: number; altura: number };
  rodapeImg?: { buf: Buffer; altura: number };
}

let FUNDO: Fundo = { ap: APARENCIA_PADRAO };

function bufferDe(dataUrl: string | null): Buffer | null {
  return dataUrl ? Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64') : null;
}

/** Lê as imagens da aparência, mede cada uma e define onde começa e onde termina o conteúdo das páginas. */
function prepararFundo(doc: PDFKit.PDFDocument, ap: Aparencia) {
  aplicarCores(ap.cores);
  const largPag = doc.page.width;
  const altPag = doc.page.height;
  const fundo: Fundo = { ap };

  const bufLogo = ap.logo.visivel ? bufferDe(ap.logo.imagem) : null;
  if (bufLogo) {
    const im = (doc as any).openImage(bufLogo) as { width: number; height: number };
    fundo.logo = { buf: bufLogo, largura: ap.logo.largura, altura: (ap.logo.largura * im.height) / im.width };
  }
  const bufMarca = ap.marcaDagua.visivel ? bufferDe(ap.marcaDagua.imagem) : null;
  if (bufMarca) {
    const im = (doc as any).openImage(bufMarca) as { width: number; height: number };
    const l = (largPag * ap.marcaDagua.tamanho) / 100;
    fundo.marca = { buf: bufMarca, largura: l, altura: (l * im.height) / im.width };
  }
  const bufRodape = ap.rodape.modo === 'imagem' ? bufferDe(ap.rodape.imagem) : null;
  if (bufRodape) {
    const im = (doc as any).openImage(bufRodape) as { width: number; height: number };
    fundo.rodapeImg = { buf: bufRodape, altura: (largPag * im.height) / im.width };
  }

  // topo: o título vem logo abaixo do logo (ou da faixa fina, se não houver logo)
  TOPO_CONTEUDO = fundo.logo ? Math.max(ALTURA_TOPO_PADRAO, 20 + fundo.logo.altura + 14) : 40;
  // fim: acima do rodapé (a faixa de "Página n de m" fica nos ~14 pt acima dele)
  const alturaRodape = fundo.rodapeImg ? fundo.rodapeImg.altura : ap.rodape.textoEsquerda.trim() || ap.rodape.textoDireita.trim() || ap.rodape.barra ? 62 : 24;
  FIM_CONTEUDO = Math.round(altPag - alturaRodape - 18);
  FUNDO = fundo;
}

function desenharMarcaDagua(doc: PDFKit.PDFDocument) {
  const L = doc.page.width;
  const A = doc.page.height;
  const { ap, logo, marca, rodapeImg } = FUNDO;
  // sem isso, escrever perto do fim da página (o rodapé) faz o pdfkit criar uma página nova
  const margemInferior = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  if (marca) {
    doc.save();
    doc.opacity(ap.marcaDagua.opacidade);
    doc.image(marca.buf, (L - marca.largura) / 2, (A - marca.altura) / 2, { width: marca.largura });
    doc.restore();
  }
  doc.rect(0, 0, L, 7).fill(FAIXA_SUPERIOR);
  if (logo) doc.image(logo.buf, 22, 20, { width: logo.largura });

  if (rodapeImg) {
    doc.image(rodapeImg.buf, 0, A - rodapeImg.altura, { width: L });
  } else {
    // rodapé de texto: um bloco à esquerda, uma linha vertical, um bloco à direita, e a barra na base
    const e = ap.rodape.textoEsquerda.trim();
    const d = ap.rodape.textoDireita.trim();
    const yTexto = A - (ap.rodape.barra ? 10 : 0) - 44;
    doc.font('Helvetica').fontSize(8.5).fillColor(CINZA);
    if (e && d) {
      doc.text(e, MARGEM, yTexto, { width: L / 2 - MARGEM - 14, align: 'center', lineGap: 2 });
      doc.moveTo(L / 2, yTexto - 4).lineTo(L / 2, yTexto + 36).strokeColor(MARINHO).lineWidth(1.2).stroke();
      doc.fillColor(CINZA).text(d, L / 2 + 16, yTexto, { width: L / 2 - MARGEM - 16, align: 'left', lineGap: 2 });
    } else if (e || d) {
      doc.text(e || d, MARGEM, yTexto, { width: L - MARGEM * 2, align: 'center', lineGap: 2 });
    }
    if (ap.rodape.barra) doc.rect(0, A - 10, L, 10).fill(MARINHO);
  }
  doc.page.margins.bottom = margemInferior;
  doc.x = MARGEM; // image() mexe no cursor; o conteúdo de cada página começa abaixo do cabeçalho
  doc.y = TOPO_CONTEUDO;
}

const TITULO = 'Relatório de Vencimentos de Férias, Experiência e Afastamentos';

interface Trecho { texto: string; negrito: boolean; italico: boolean; cor?: string }

/**
 * Quebra o texto nos trechos do WhatsApp: *negrito*, _itálico_ e normais. O itálico só vale com "_" colado nas
 * bordas de palavra (nome_de_arquivo não vira itálico).
 */
export function trechos(linha: string): Trecho[] {
  const saida: Trecho[] = [];
  const re = /\*([^*\n]+)\*|(?<![\p{L}\p{N}])_([^_\n]+)_(?![\p{L}\p{N}])/gu;
  let ultimo = 0;
  for (const m of linha.matchAll(re)) {
    if (m.index! > ultimo) saida.push({ texto: linha.slice(ultimo, m.index), negrito: false, italico: false });
    saida.push(m[1] !== undefined ? { texto: m[1], negrito: true, italico: false } : { texto: m[2], negrito: false, italico: true });
    ultimo = m.index! + m[0].length;
  }
  if (ultimo < linha.length) saida.push({ texto: linha.slice(ultimo), negrito: false, italico: false });
  return saida;
}

const fonteDe = (t: { negrito: boolean; italico: boolean }) => (t.negrito ? 'Helvetica-Bold' : t.italico ? 'Helvetica-Oblique' : 'Helvetica');

interface Palavra { texto: string; negrito: boolean; italico: boolean; cor?: string; x: number }

/**
 * Quebra trechos formatados em linhas visuais de no máximo `largura`, medindo cada palavra na fonte certa.
 * (O modo "continued" do pdfkit embaralha a quebra quando a fonte muda no meio da linha, por isso a quebra é feita aqui.)
 */
export function quebrarTrechos(doc: PDFKit.PDFDocument, partes: Trecho[], largura: number, tamanho: number): Palavra[][] {
  const linhas: Palavra[][] = [[]];
  let x = 0;
  for (const seg of partes) {
    doc.font(fonteDe(seg)).fontSize(tamanho);
    for (const peca of seg.texto.split(/(\s+)/)) {
      if (!peca) continue;
      const w = doc.widthOfString(peca);
      const espaco = /^\s+$/.test(peca);
      if (x + w > largura && !espaco && x > 0) {
        linhas.push([]);
        x = 0;
      }
      if (espaco && x === 0) continue; // sem espaço no começo da linha
      linhas[linhas.length - 1].push({ texto: peca, negrito: seg.negrito, italico: seg.italico, cor: seg.cor, x });
      x += w;
    }
  }
  return linhas;
}

export function quebrarLinha(doc: PDFKit.PDFDocument, linha: string, largura: number, tamanho: number): Palavra[][] {
  return quebrarTrechos(doc, trechos(linha), largura, tamanho);
}

/** Desenha linhas já quebradas a partir de (x, y); devolve a altura usada. */
function desenharLinhas(doc: PDFKit.PDFDocument, linhas: Palavra[][], x: number, y: number, tamanho: number, corPadrao: string, entrelinha = 3): number {
  doc.fontSize(tamanho);
  const alturaLinha = doc.font('Helvetica').currentLineHeight() + entrelinha;
  linhas.forEach((palavras, n) => {
    for (const p of palavras) doc.font(fonteDe(p)).fillColor(p.cor ?? corPadrao).text(p.texto, x + p.x, y + n * alturaLinha, { lineBreak: false });
  });
  return Math.max(linhas.length, 1) * alturaLinha;
}

function alturaLinhas(doc: PDFKit.PDFDocument, linhas: Palavra[][], tamanho: number, entrelinha = 3): number {
  doc.font('Helvetica').fontSize(tamanho);
  return Math.max(linhas.length, 1) * (doc.currentLineHeight() + entrelinha);
}

/** Desenha UM relatório a partir da página atual do documento (a 1ª página já deve estar criada). */
function desenhar(doc: PDFKit.PDFDocument, d: DadosRelatorio) {
  const larguraUtil = doc.page.width - MARGEM * 2;
  const limiteInferior = () => FIM_CONTEUDO; // acima do rodapé do papel timbrado
  const garantirEspaco = (altura: number) => {
    if (doc.y + altura > limiteInferior()) doc.addPage();
  };

  // ---------- faixa do título ----------
  // (faixa dentro das margens, logo abaixo do cabeçalho do papel timbrado -- não vai de ponta a ponta da página)
  const faixa = 70;
  const topo = TOPO_CONTEUDO;
  const xTexto = MARGEM + 16;
  const larguraTexto = larguraUtil - 32;
  doc.roundedRect(MARGEM, topo, larguraUtil, faixa, 4).fill(MARINHO);
  doc.rect(MARGEM, topo + faixa, larguraUtil, 3).fill(AZUL);
  // título comprido: encolhe a fonte até caber numa linha só
  let tamanhoTitulo = 20;
  doc.font('Helvetica-Bold').fontSize(tamanhoTitulo);
  while (tamanhoTitulo > 12 && doc.widthOfString(TITULO) > larguraTexto) doc.fontSize(--tamanhoTitulo);
  doc.fillColor('#FFFFFF').text(TITULO, xTexto, topo + 12 + (20 - tamanhoTitulo) / 2, { width: larguraTexto, lineBreak: false });
  const sub: Palavra[][] = quebrarTrechos(
    doc,
    [
      { texto: 'Empresa: ', negrito: true, italico: false, cor: '#FFFFFF' },
      { texto: d.empresa, negrito: false, italico: false, cor: '#CBD5E1' },
      { texto: '  |  ', negrito: false, italico: false, cor: '#94A3B8' },
      { texto: 'Data de Emissão: ', negrito: true, italico: false, cor: '#FFFFFF' },
      { texto: d.emissao, negrito: false, italico: false, cor: '#CBD5E1' },
    ],
    larguraTexto,
    10
  );
  const alturaSub = desenharLinhas(doc, sub, xTexto, topo + 38, 10, '#CBD5E1', 2);
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(8).text(`ID ${d.codiEmp}  ·  CNPJ ${formatarCnpj(d.cnpj)}`, xTexto, topo + 38 + alturaSub + 1, { lineBreak: false });
  doc.y = topo + faixa + 3 + 20;

  // ---------- texto do modelo (opcional) ----------
  if (d.mensagem) {
    const recuo = 12;
    const larguraTexto = larguraUtil - recuo * 2 - 4;
    const tamanho = 9.5;
    const linhasMsg = d.mensagem.split('\n');
    linhasMsg.forEach((linha, idx) => {
      const quebradas = quebrarLinha(doc, linha, larguraTexto, tamanho);
      const extra = idx === 0 || idx === linhasMsg.length - 1 ? 5 : 0;
      const altura = alturaLinhas(doc, quebradas, tamanho, 1.5) + (linha ? 0 : -4) + extra * 2;
      garantirEspaco(altura);
      const y = doc.y;
      // faixa de fundo linha a linha: o balão continua certinho quando atravessa uma página
      doc.rect(MARGEM, y, larguraUtil, altura).fillOpacity(0.82).fill(MENSAGEM_FUNDO);
      doc.fillOpacity(1);
      doc.rect(MARGEM, y, 3, altura).fill(MENSAGEM_BARRA);
      desenharLinhas(doc, quebradas, MARGEM + recuo, y + extra, tamanho, TEXTO, 1.5);
      doc.y = y + altura;
      doc.x = MARGEM;
    });
    doc.y += 18;
  }

  // ---------- helpers de seção ----------
  const titulo = (texto: string, cor: string) => {
    garantirEspaco(60);
    const y = doc.y;
    doc.circle(MARGEM + 7, y + 8, 7).fill(cor);
    doc.fillColor(CINZA_ESCURO).font('Helvetica-Bold').fontSize(13).text(texto, MARGEM + 22, y + 1, { lineBreak: false });
    doc.y = y + 24;
  };
  const paragrafo = (texto: string) => {
    const linhas = quebrarLinha(doc, texto, larguraUtil, 9.5);
    const altura = alturaLinhas(doc, linhas, 9.5, 3);
    garantirEspaco(altura);
    const h = desenharLinhas(doc, linhas, MARGEM, doc.y, 9.5, '#475569');
    doc.y += h + 8;
  };
  const vazio = () => {
    doc.fillColor(CINZA).font('Helvetica-Oblique').fontSize(9.5).text('Nenhum registro no momento.', MARGEM + 4, doc.y, { lineBreak: false });
    doc.y += 22;
  };

  // ---------- Alertas Críticos: Férias com Risco ----------
  titulo('Alertas Críticos: Férias com Risco', VERMELHO);
  paragrafo('Avisos urgentes de colaboradores próximos ao limite concessivo, com risco de pagamento em dobro e acúmulo de dois períodos aquisitivos.');
  if (d.criticos.length === 0) vazio();
  for (const c of d.criticos) {
    const venceu = c.faltam < 0;
    const itens: Trecho[][] = [
      [
        { texto: 'Dias pendentes: ', negrito: true, italico: false, cor: VERMELHO_ESCURO },
        { texto: `${c.diasPendentes} dias (Período aquisitivo encerrado em ${c.periodoEncerrado}).`, negrito: false, italico: false },
      ],
      [
        { texto: 'Prazo limite para gozo: ', negrito: true, italico: false, cor: VERMELHO_ESCURO },
        { texto: venceu ? `${c.prazoLimite} (Venceu há ${-c.faltam} dias).` : `${c.prazoLimite} (Faltam ${c.faltam} dias).`, negrito: false, italico: false },
      ],
      [
        { texto: 'Atenção: ', negrito: true, italico: false, cor: VERMELHO_ESCURO },
        {
          texto:
            (venceu ? 'O prazo já passou: a empresa está sujeita ao pagamento em dobro.' : 'Após esta data, a empresa estará sujeita ao pagamento em dobro.') +
            (c.segundoPeriodo ? ` O colaborador completará um 2º período aquisitivo no dia ${c.segundoPeriodo}.` : ''),
          negrito: false,
          italico: false,
        },
      ],
    ];
    const recuoTexto = 28;
    const larguraTexto = larguraUtil - recuoTexto - 12;
    const quebrados = itens.map((it) => quebrarTrechos(doc, it, larguraTexto, 9.5));
    const alturaItens = quebrados.reduce((s, q) => s + alturaLinhas(doc, q, 9.5, 3) + 3, 0);
    const altura = 12 + 15 + alturaItens + 6;
    garantirEspaco(altura);
    const y = doc.y;
    doc.roundedRect(MARGEM, y, larguraUtil, altura, 3).fillOpacity(0.82).fill(VERMELHO_FUNDO);
      doc.fillOpacity(1);
    doc.rect(MARGEM, y, 3, altura).fill(VERMELHO);
    doc.fillColor(VERMELHO_ESCURO).font('Helvetica-Bold').fontSize(11).text(c.nome, MARGEM + 16, y + 11, { width: larguraUtil - 32, lineBreak: false });
    let yy = y + 11 + 18;
    quebrados.forEach((q) => {
      doc.circle(MARGEM + 20, yy + 5, 1.6).fill(TEXTO);
      yy += desenharLinhas(doc, q, MARGEM + recuoTexto, yy, 9.5, TEXTO, 3) + 3;
    });
    doc.y = y + altura + 12;
  }
  doc.y += 6;

  // ---------- Alertas de Férias: Prazos Regulares ----------
  titulo('Alertas de Férias: Prazos Regulares', AMARELO);
  const dias = new Set(d.regulares.map((r) => r.diasPendentes));
  const todosIguais = d.regulares.length > 0 && dias.size === 1;
  paragrafo(
    `Colaboradores que já possuem períodos aquisitivos encerrados e podem tirar férias${todosIguais ? ` (todos com ${[...dias][0]} dias pendentes)` : ''}. Recomenda-se o planejamento para evitar vencimento.`
  );
  if (d.regulares.length === 0) {
    vazio();
  } else {
    const mostrarDias = !todosIguais;
    const colunas = mostrarDias
      ? [{ t: 'COLABORADOR', l: 3 }, { t: 'PERÍODO ENCERRADO EM', l: 2 }, { t: 'PRAZO LIMITE (CONCESSÃO)', l: 2.3 }, { t: 'DIAS PEND.', l: 1.1 }]
      : [{ t: 'COLABORADOR', l: 3 }, { t: 'PERÍODO ENCERRADO EM', l: 2.2 }, { t: 'PRAZO LIMITE (CONCESSÃO)', l: 2.6 }];
    const soma = colunas.reduce((s, c) => s + c.l, 0);
    const larguras = colunas.map((c) => (c.l / soma) * larguraUtil);
    const pad = 12;
    const cabecalho = () => {
      garantirEspaco(30);
      const y = doc.y;
      doc.rect(MARGEM, y, larguraUtil, 24).fillOpacity(0.82).fill(TABELA_CABECALHO);
      doc.fillOpacity(1);
      let x = MARGEM;
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8.5);
      colunas.forEach((c, i) => {
        doc.text(c.t, x + pad, y + 8, { width: larguras[i] - pad, lineBreak: false });
        x += larguras[i];
      });
      doc.y = y + 24;
    };
    cabecalho();
    for (const r of d.regulares) {
      const celulas = mostrarDias ? [r.nome, r.periodoEncerrado, r.prazoLimite, r.diasPendentes] : [r.nome, r.periodoEncerrado, r.prazoLimite];
      doc.fontSize(9.5);
      const altura = Math.max(...celulas.map((c, i) => doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').heightOfString(c || '—', { width: larguras[i] - pad }))) + 16;
      if (doc.y + altura > limiteInferior()) {
        doc.addPage();
        cabecalho();
      }
      const y = doc.y;
      doc.moveTo(MARGEM, y + altura).lineTo(MARGEM + larguraUtil, y + altura).strokeColor(LINHA).lineWidth(0.7).stroke();
      let x = MARGEM;
      celulas.forEach((c, i) => {
        doc.fillColor(i === 0 ? TEXTO : '#475569').font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).text(c || '—', x + pad, y + 8, { width: larguras[i] - pad });
        x += larguras[i];
      });
      doc.y = y + altura;
    }
    doc.y += 18;
  }

  // ---------- Alerta de Contrato ----------
  titulo('Alerta de Contrato', AZUL);
  if (d.contratos.length === 0) {
    vazio();
  } else {
    for (const c of d.contratos) {
      const linhas = quebrarTrechos(
        doc,
        [
          { texto: c.nome, negrito: true, italico: false, cor: CINZA_ESCURO },
          { texto: ': ', negrito: false, italico: false },
          // a descrição traz as datas entre *asteriscos* (negrito)
          ...trechos(c.descricao).map((p) => (p.negrito ? { ...p, cor: CINZA_ESCURO } : p)),
          { texto: ` ${c.acao}`, negrito: false, italico: false },
        ],
        larguraUtil - 28,
        9.5
      );
      const altura = alturaLinhas(doc, linhas, 9.5, 3) + 18;
      garantirEspaco(altura + 10);
      const y = doc.y;
      doc.roundedRect(MARGEM, y, larguraUtil, altura, 3).fillOpacity(0.82).fill(AZUL_FUNDO);
      doc.fillOpacity(1);
      doc.rect(MARGEM, y, 3, altura).fill(AZUL);
      desenharLinhas(doc, linhas, MARGEM + 16, y + 9, 9.5, TEXTO, 3);
      doc.y = y + altura + 10;
    }
  }
  doc.y += 10;
  // ---------- extras (só aparecem quando há registro) ----------
  if (d.afastados.length > 0) {
    titulo('Afastados', CINZA);
    paragrafo('Colaboradores afastados no momento.');
    for (const a of d.afastados) {
      const linhas = quebrarTrechos(
        doc,
        [
          { texto: `${a.nome}: `, negrito: true, italico: false, cor: CINZA_ESCURO },
          { texto: `${a.motivo}, desde `, negrito: false, italico: false },
          { texto: a.inicio, negrito: true, italico: false, cor: CINZA_ESCURO },
          { texto: a.retorno !== '—' ? `, com previsão de retorno em ${a.retorno}.` : '.', negrito: false, italico: false },
        ],
        larguraUtil - 16,
        9.5
      );
      garantirEspaco(alturaLinhas(doc, linhas, 9.5, 3) + 8);
      doc.circle(MARGEM + 4, doc.y + 6, 1.6).fill(TEXTO);
      doc.y += desenharLinhas(doc, linhas, MARGEM + 16, doc.y, 9.5, TEXTO, 3) + 8;
    }
    doc.y += 10;
  }
  if (d.segundoPeriodo.length > 0) {
    titulo('Vencimento de 2º Período de Férias', COR_SEGUNDO_PERIODO);
    paragrafo('Colaboradores que vão acumular um segundo período completo — o período pendente precisa ser gozado antes.');
    for (const s of d.segundoPeriodo) {
      const linhas = quebrarTrechos(
        doc,
        [
          { texto: `${s.nome}: `, negrito: true, italico: false, cor: CINZA_ESCURO },
          { texto: '2º período completo em ', negrito: false, italico: false },
          { texto: s.vencimento, negrito: true, italico: false, cor: CINZA_ESCURO },
          { texto: `; limite do período pendente: ${s.limite}.`, negrito: false, italico: false },
        ],
        larguraUtil - 16,
        9.5
      );
      garantirEspaco(alturaLinhas(doc, linhas, 9.5, 3) + 8);
      doc.circle(MARGEM + 4, doc.y + 6, 1.6).fill(TEXTO);
      doc.y += desenharLinhas(doc, linhas, MARGEM + 16, doc.y, 9.5, TEXTO, 3) + 8;
    }
    doc.y += 10;
  }
  if (d.aniversariantes.length > 0) {
    titulo('Aniversariantes do Mês', COR_ANIVERSARIO);
    paragrafo('Colaboradores que fazem aniversário neste mês.');
    for (const a of d.aniversariantes) {
      const verbo = a.hoje ? 'completa' : a.jaPassou ? 'completou' : 'completa';
      const linhas = quebrarTrechos(
        doc,
        [
          { texto: `${a.nome}: `, negrito: true, italico: false, cor: CINZA_ESCURO },
          { texto: 'aniversário em ', negrito: false, italico: false },
          { texto: a.data, negrito: true, italico: false, cor: CINZA_ESCURO },
          { texto: a.hoje ? ` — é hoje! Completa ${a.idade} anos.` : ` — ${verbo} ${a.idade} anos.`, negrito: a.hoje, italico: false, cor: a.hoje ? COR_ANIVERSARIO_HOJE : undefined },
        ],
        larguraUtil - 16,
        9.5
      );
      garantirEspaco(alturaLinhas(doc, linhas, 9.5, 3) + 8);
      doc.circle(MARGEM + 4, doc.y + 6, 1.6).fill(TEXTO);
      doc.y += desenharLinhas(doc, linhas, MARGEM + 16, doc.y, 9.5, TEXTO, 3) + 8;
    }
    doc.y += 10;
  }

  // ---------- Precisa de ajuda com esses dados? ----------
  if (d.contatoAjuda) {
    const linhas = quebrarTrechos(
      doc,
      [
        { texto: 'Caso tenha dúvidas sobre os prazos ou queira orientações para conceder as férias, entre em contato via ligação ou mensagem pelo aplicativo do WhatsApp: ', negrito: false, italico: false },
        { texto: d.contatoAjuda, negrito: true, italico: false },
        { texto: '.', negrito: false, italico: false },
      ],
      larguraUtil - 28,
      9.5
    ).map((l) => l.map((p) => ({ ...p, cor: VERDE_TEXTO })));
    const altura = 14 + 17 + alturaLinhas(doc, linhas, 9.5, 3) + 8;
    garantirEspaco(altura + 4);
    const y = doc.y;
    doc.roundedRect(MARGEM, y, larguraUtil, altura, 3).fillOpacity(0.82).fill(VERDE_FUNDO);
      doc.fillOpacity(1);
    doc.rect(MARGEM, y, 3, altura).fill(VERDE);
    doc.fillColor(VERDE_TEXTO).font('Helvetica-Bold').fontSize(10.5).text('Precisa de ajuda com esses dados?', MARGEM + 16, y + 11, { lineBreak: false });
    desenharLinhas(doc, linhas, MARGEM + 16, y + 11 + 18, 9.5, VERDE_TEXTO, 3);
    doc.y = y + altura + 6;
  }
}
/** Rodapé: razão social à esquerda e "Página n" à direita, por empresa (cada relatório do lote recomeça a numeração). */
function rodapes(doc: PDFKit.PDFDocument, blocos: { inicio: number; fim: number; d: DadosRelatorio }[]) {
  const larguraUtil = doc.page.width - MARGEM * 2;
  for (const b of blocos) {
    for (let i = b.inicio; i <= b.fim; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // sem isso, escrever perto do fim da página cria uma página nova
      const y = FIM_CONTEUDO + 8; // logo acima do endereço/contatos do papel timbrado (que começa em ~780)
      doc.moveTo(MARGEM, y - 5).lineTo(MARGEM + larguraUtil, y - 5).strokeColor(LINHA).lineWidth(0.5).stroke();
      doc.fillColor(CINZA).font('Helvetica').fontSize(8);
      doc.text(b.d.empresa, MARGEM, y, { width: larguraUtil - 80, lineBreak: false });
      doc.text(`Página ${i - b.inicio + 1} de ${b.fim - b.inicio + 1}`, MARGEM + larguraUtil - 80, y, { width: 80, align: 'right', lineBreak: false });
    }
  }
}

/** Um PDF com UM relatório por empresa, um depois do outro (cada um começa em página nova). */
export function gerarPdfLote(lista: DadosRelatorio[], aparencia: Aparencia = APARENCIA_PADRAO): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const titulo = lista.length === 1 ? `${TITULO} — ${lista[0].empresa}` : `${TITULO} — ${lista.length} empresas`;
    const doc = new PDFDocument({ size: 'A4', margin: MARGEM, bufferPages: true, info: { Title: titulo, Author: 'Prazos' } });
    const partes: Buffer[] = [];
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    try {
      prepararFundo(doc, aparencia);
    } catch (e) {
      reject(e);
      return;
    }
    doc.on('pageAdded', () => desenharMarcaDagua(doc)); // toda página nova já nasce com o papel timbrado
    desenharMarcaDagua(doc); // a 1ª página já existe quando o ouvinte é registrado
    try {
      const blocos: { inicio: number; fim: number; d: DadosRelatorio }[] = [];
      lista.forEach((d, idx) => {
        if (idx > 0) doc.addPage();
        const inicio = doc.bufferedPageRange().count - 1;
        desenhar(doc, d);
        blocos.push({ inicio, fim: doc.bufferedPageRange().count - 1, d });
      });
      rodapes(doc, blocos);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

export function gerarPdf(d: DadosRelatorio, aparencia: Aparencia = APARENCIA_PADRAO): Promise<Buffer> {
  return gerarPdfLote([d], aparencia);
}
