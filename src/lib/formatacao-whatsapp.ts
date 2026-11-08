// Formatação do WhatsApp: *negrito* e _itálico_. Usada pra mostrar na tela o mesmo texto que sai no WhatsApp e no PDF.
// O itálico só vale com "_" colado nas bordas de palavra (nome_de_arquivo não vira itálico).
export interface TrechoFormatado { texto: string; negrito: boolean; italico: boolean }

export function partesFormatadas(linha: string): TrechoFormatado[] {
  const saida: TrechoFormatado[] = [];
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

/** Troca {{variavel}} pelos valores; as variáveis (menos "avisos", que já vem marcado) saem em negrito, igual ao servidor. */
export function renderizarModelo(corpo: string, valores: Record<string, string>): string {
  return corpo.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (inteiro, nome: string, pos: number) => {
    if (!(nome in valores)) return inteiro;
    const valor = valores[nome];
    if (nome === 'avisos') return valor;
    // o modelo já formatou essa variável (*{{x}}* ou _{{x}}_): respeita, sem empilhar marcas
    const antes = corpo[pos - 1];
    const depois = corpo[pos + inteiro.length];
    const jaFormatado = (antes === '*' && depois === '*') || (antes === '_' && depois === '_');
    return jaFormatado ? valor.replace(/\*/g, '') : `*${valor.replace(/\*/g, '')}*`;
  });
}
