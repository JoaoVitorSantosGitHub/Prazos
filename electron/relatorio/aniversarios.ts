import { AlertaAniversarianteDominio } from '../dominio/dominio.service';
import { dataEmSaoPaulo } from './horario.util';

export interface AniversarianteMontado {
  nome: string;
  /** "dd/mm" */
  data: string;
  /** Idade que a pessoa completa (ou completou) neste ano. */
  idade: number;
  /** O aniversário é hoje. */
  hoje: boolean;
  /** O aniversário já passou neste mês. */
  jaPassou: boolean;
}

/**
 * Aniversariantes do mês de uma empresa, em ordem de dia (e de nome). `hoje` = AAAA-MM-DD em São Paulo.
 * A ponte já manda só quem faz aniversário no mês corrente do banco; aqui se confere de novo contra a data de São Paulo
 * (a virada do mês pode pegar uma resposta em cache), então quem não é do mês de `hoje` fica de fora.
 */
export function montarAniversariantes(lista: AlertaAniversarianteDominio[], hoje: string = dataEmSaoPaulo(new Date())): AniversarianteMontado[] {
  const [anoHoje, mesHoje, diaHoje] = hoje.split('-').map(Number);
  return lista
    .filter((a) => a.mes === mesHoje)
    .map((a) => ({
      nome: a.nome,
      data: `${String(a.dia).padStart(2, '0')}/${String(a.mes).padStart(2, '0')}`,
      idade: anoHoje - a.ano,
      hoje: a.dia === diaHoje,
      jaPassou: a.dia < diaHoje,
      dia: a.dia,
    }))
    .sort((x, y) => x.dia - y.dia || x.nome.localeCompare(y.nome, 'pt-BR'))
    .map(({ dia: _dia, ...resto }) => resto);
}
