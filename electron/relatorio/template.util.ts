// Variáveis que o master pode usar no modelo de mensagem. São trocadas na hora de
// enfileirar (ver FilaEnvioService). Qualquer outra {{coisa}} é recusada ao salvar
// -- melhor avisar do erro de digitação do que mandar "{{empresaa}}" pro cliente.
export const VARIAVEIS_TEMPLATE = ['empresa', 'avisos', 'quantidade', 'data'] as const;
export type VariavelTemplate = (typeof VARIAVEIS_TEMPLATE)[number];

// Usado nos avisos automáticos quando nenhum modelo está marcado como padrão.
export const TEXTO_PADRAO_AVISOS =
  'Olá! Seguem os avisos da folha de pagamento de {{empresa}} ({{data}}):\n\n{{avisos}}\n\nMensagem automática do escritório.';

// O relatório em PDF tem as mesmas variáveis do WhatsApp + id e CNPJ da empresa.
export const VARIAVEIS_RELATORIO = [...VARIAVEIS_TEMPLATE, 'id', 'cnpj'] as const;

export const TEXTO_PADRAO_RELATORIO =
  'Relatório de situação da folha de pagamento\n\nEmpresa: {{empresa}}\nID {{id}} · CNPJ {{cnpj}}\nData: {{data}}\n\nAvisos ({{quantidade}}):\n{{avisos}}';

export const LIMITE_CORPO_TEMPLATE = 1500;

const REGEX_VARIAVEL = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export function variaveisUsadas(corpo: string): string[] {
  return [...new Set([...corpo.matchAll(REGEX_VARIAVEL)].map((m) => m[1]))];
}

/** Devolve a mensagem de erro, ou null se o corpo é válido. */
export function validarCorpoTemplate(corpo: string, permitidas: readonly string[] = VARIAVEIS_TEMPLATE): string | null {
  if (!corpo.trim()) return 'O texto do modelo não pode ficar vazio.';
  if (corpo.length > LIMITE_CORPO_TEMPLATE) return `O texto passa de ${LIMITE_CORPO_TEMPLATE} caracteres.`;
  const desconhecidas = variaveisUsadas(corpo).filter((v) => !permitidas.includes(v));
  if (desconhecidas.length) {
    return `Variável desconhecida: ${desconhecidas.map((v) => `{{${v}}}`).join(', ')}. Use só: ${permitidas.map((v) => `{{${v}}}`).join(', ')}.`;
  }
  return null;
}

// No WhatsApp, *texto* sai em negrito. As variáveis trocadas saem em negrito pra destacar o que é dado do que é texto
// fixo do modelo. {{avisos}} já vem com os destaques (funcionário, datas, prazos) marcados linha a linha: negrito não
// atravessa quebra de linha, então não embrulha o bloco inteiro. Se o modelo já pôs *{{variável}}*, não dobra o negrito.
export function renderizarTemplate(corpo: string, valores: Record<string, string>): string {
  return corpo.replace(REGEX_VARIAVEL, (inteiro: string, nome: string, posicao: number) => {
    if (!(nome in valores)) return inteiro;
    const valor = valores[nome];
    if (nome === 'avisos') return valor; // já vem marcado linha a linha
    // o modelo já formatou essa variável (*{{x}}* ou _{{x}}_): respeita, sem empilhar marcas (viraria _*x*_ com o '_' aparecendo)
    const antes = corpo[posicao - 1];
    const depois = corpo[posicao + inteiro.length];
    const jaFormatado = (antes === '*' && depois === '*') || (antes === '_' && depois === '_');
    return jaFormatado ? valor.replace(/\*/g, '') : `*${valor.replace(/\*/g, '')}*`;
  });
}

/** Tira as marcas de negrito (*) -- o histórico e o log de e-mail guardam o texto limpo. */
export function semNegrito(texto: string): string {
  return texto.replace(/\*/g, '');
}