// Tudo que depende de "que data é hoje em São Paulo" passa por aqui, pra não depender do fuso configurado no container.
export const FUSO_SAO_PAULO = 'America/Sao_Paulo';

const formatador = new Intl.DateTimeFormat('en-US', { timeZone: FUSO_SAO_PAULO, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Data (AAAA-MM-DD) em São Paulo. */
export function dataEmSaoPaulo(d: Date): string {
  const o: Record<string, string> = {};
  for (const p of formatador.formatToParts(d)) if (p.type !== 'literal') o[p.type] = p.value;
  return `${o.year}-${o.month}-${o.day}`;
}