import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Aparência do relatório em PDF (o "papel timbrado"): logo no canto superior esquerdo, marca d'água, rodapé e cores.
 * O app é distribuído pra vários escritórios, então NÃO traz marca de ninguém: o padrão é neutro (sem logo e sem marca
 * d'água) e cada escritório coloca o seu. `imagem: null` = sem imagem; a escolhida pelo usuário fica guardada aqui como
 * data URL (PNG ou JPEG). A aparência é única por instalação: vale pra todos os relatórios.
 */
export interface Aparencia {
  /** Telefone/WhatsApp do escritório pro quadro "Precisa de ajuda com esses dados?" do PDF; vazio = sem o quadro. */
  contatoAjuda: string;
  logo: { visivel: boolean; imagem: string | null; /** largura em pt (A4 = 595 pt) */ largura: number };
  marcaDagua: { visivel: boolean; imagem: string | null; /** 0.02 a 1 */ opacidade: number; /** % da largura da página */ tamanho: number };
  rodape: {
    /** 'imagem' = faixa de imagem na largura da página; 'texto' = dois blocos de texto + barra */
    modo: 'imagem' | 'texto';
    imagem: string | null;
    textoEsquerda: string;
    textoDireita: string;
    barra: boolean;
  };
  cores: CoresRelatorio;
}

export interface CoresRelatorio {
  /** linha fina no topo da página */
  faixaSuperior: string;
  /** faixa do título e barra do rodapé */
  titulo: string;
  /** linha sob o título e "Alerta de Contrato" */
  destaque: string;
  /** férias com risco (os tons de fundo e de texto saem dela) */
  critico: string;
  /** prazos regulares de férias */
  atencao: string;
  /** texto do modelo e quadro de ajuda */
  mensagem: string;
  /** título da seção "Vencimento de 2º Período de Férias" */
  segundoPeriodo: string;
  /** título da seção "Aniversariantes do Mês" (o "é hoje!" sai dela, mais escura) */
  aniversario: string;
}

export const CORES_PADRAO: CoresRelatorio = {
  faixaSuperior: '#3B82F6',
  titulo: '#1E293B',
  destaque: '#3B82F6',
  critico: '#EF4444',
  atencao: '#F59E0B',
  mensagem: '#10B981',
  segundoPeriodo: '#14B8A6',
  aniversario: '#EC4899',
};

export const APARENCIA_PADRAO: Aparencia = {
  contatoAjuda: '',
  logo: { visivel: true, imagem: null, largura: 160 },
  marcaDagua: { visivel: true, imagem: null, opacidade: 0.12, tamanho: 55 },
  rodape: { modo: 'texto', imagem: null, textoEsquerda: '', textoDireita: '', barra: true },
  cores: CORES_PADRAO,
};

const LIMITE_IMAGEM = 4 * 1024 * 1024; // caracteres do data URL (~3 MB de imagem)
const REGEX_IMAGEM = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
const REGEX_COR = /^#[0-9a-fA-F]{6}$/;

export class ErroAparencia extends Error {}

const numero = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};
const texto = (v: unknown, padrao: string, max = 400) => (typeof v === 'string' ? v.slice(0, max) : padrao);

function imagem(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' || v.length > LIMITE_IMAGEM || !REGEX_IMAGEM.test(v)) {
    throw new ErroAparencia('Imagem inválida: use um arquivo PNG ou JPEG de até 3 MB.');
  }
  return v;
}

function cor(v: unknown, padrao: string): string {
  if (v === undefined || v === null) return padrao;
  if (typeof v !== 'string' || !REGEX_COR.test(v)) throw new ErroAparencia('Cor inválida (use o formato #RRGGBB).');
  return v.toUpperCase();
}

/** Completa o que faltar com o padrão e recusa valores inválidos (imagem que não é PNG/JPEG, cor fora do formato). */
export function validarAparencia(bruto: unknown): Aparencia {
  const x = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, any>;
  const p = APARENCIA_PADRAO;
  return {
    contatoAjuda: texto(x.contatoAjuda, p.contatoAjuda, 60).trim(),
    logo: {
      visivel: x.logo?.visivel ?? p.logo.visivel,
      imagem: imagem(x.logo?.imagem),
      largura: numero(x.logo?.largura, 40, 300, p.logo.largura),
    },
    marcaDagua: {
      visivel: x.marcaDagua?.visivel ?? p.marcaDagua.visivel,
      imagem: imagem(x.marcaDagua?.imagem),
      opacidade: numero(x.marcaDagua?.opacidade, 0.02, 1, p.marcaDagua.opacidade),
      tamanho: numero(x.marcaDagua?.tamanho, 20, 100, p.marcaDagua.tamanho),
    },
    rodape: {
      modo: x.rodape?.modo === 'imagem' || x.rodape?.modo === 'texto' ? x.rodape.modo : p.rodape.modo,
      imagem: imagem(x.rodape?.imagem),
      textoEsquerda: texto(x.rodape?.textoEsquerda, p.rodape.textoEsquerda),
      textoDireita: texto(x.rodape?.textoDireita, p.rodape.textoDireita),
      barra: x.rodape?.barra ?? p.rodape.barra,
    },
    cores: {
      faixaSuperior: cor(x.cores?.faixaSuperior, CORES_PADRAO.faixaSuperior),
      titulo: cor(x.cores?.titulo, CORES_PADRAO.titulo),
      destaque: cor(x.cores?.destaque, CORES_PADRAO.destaque),
      critico: cor(x.cores?.critico, CORES_PADRAO.critico),
      atencao: cor(x.cores?.atencao, CORES_PADRAO.atencao),
      mensagem: cor(x.cores?.mensagem, CORES_PADRAO.mensagem),
      segundoPeriodo: cor(x.cores?.segundoPeriodo, CORES_PADRAO.segundoPeriodo),
      aniversario: cor(x.cores?.aniversario, CORES_PADRAO.aniversario),
    },
  };
}

/** Mistura duas cores #RRGGBB: t = 0 devolve `a`, t = 1 devolve `b`. */
export function misturar(a: string, b: string, t: number): string {
  const canal = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const c = (i: number) => Math.round(canal(a, i) + (canal(b, i) - canal(a, i)) * t).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`.toUpperCase();
}

/** A aparência escolhida pelo usuário, guardada num arquivo JSON na pasta de dados (o app não tem banco). */
export class AparenciaStore {
  constructor(private arquivo: string) {}

  obter(): Aparencia {
    try {
      return validarAparencia(JSON.parse(fs.readFileSync(this.arquivo, 'utf8')));
    } catch {
      return APARENCIA_PADRAO;
    }
  }

  /** true se o usuário já personalizou alguma coisa. */
  personalizada(): boolean {
    return fs.existsSync(this.arquivo);
  }

  salvar(bruto: unknown): Aparencia {
    const ap = validarAparencia(bruto);
    fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
    fs.writeFileSync(this.arquivo, JSON.stringify(ap), 'utf8');
    return ap;
  }

  restaurar(): Aparencia {
    try { fs.rmSync(this.arquivo, { force: true }); } catch { /* já não existia */ }
    return APARENCIA_PADRAO;
  }
}
