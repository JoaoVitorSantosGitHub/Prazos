import * as mammoth from 'mammoth';

const ENTIDADES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/**
 * Converte o HTML que o Word gera (via mammoth) no texto do modelo: parágrafos viram linhas, **negrito** vira *negrito*,
 * itálico vira _itálico_ e itens de lista viram "• item". As {{variáveis}} que o autor digitou no Word seguem como estão.
 */
export function htmlParaTextoModelo(html: string): string {
  let t = html
    .replace(/<\s*(strong|b)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, (_m, _t, c) => marcar(c, '*'))
    .replace(/<\s*(em|i)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, (_m, _t, c) => marcar(c, '_'))
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '• ')
    .replace(/<\s*\/\s*(p|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<\s*\/\s*t[dh]\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  t = t.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTIDADES[m] ?? m);
  return t.split('\n').map((l) => l.replace(/[ \t]+$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// marca só o texto (sem espaços nas pontas e sem marcas aninhadas dentro), pra *negrito* e _itálico_ não quebrarem
function marcar(conteudo: string, marca: string): string {
  const limpo = conteudo.replace(/<[^>]+>/g, '');
  const interno = limpo.trim();
  if (!interno) return limpo;
  const antes = limpo.slice(0, limpo.indexOf(interno));
  const depois = limpo.slice(antes.length + interno.length);
  return `${antes}${marca}${interno.replace(marca === '*' ? /\*/g : /_/g, '')}${marca}${depois}`;
}

/** Lê um arquivo .docx e devolve o texto pronto pra virar o corpo de um modelo. */
export async function textoDeDocx(caminho: string): Promise<string> {
  if (!/\.docx$/i.test(caminho)) {
    throw new Error('Só arquivos .docx são aceitos. Se o modelo for um .doc antigo, abra no Word e use "Salvar como" → Documento do Word (.docx).');
  }
  const { value } = await mammoth.convertToHtml({ path: caminho });
  const texto = htmlParaTextoModelo(value);
  if (!texto) throw new Error('O documento está vazio.');
  return texto;
}
