import { MonitoramentoDominio } from '../dominio/dominio.service';
import { marcoLimiteGozo, TipoMarcoLimiteGozo } from './marcos-limite-gozo';
import { dataEmSaoPaulo } from './horario.util';

type TipoAvisoDominio = 'PODEM_TIRAR_FERIAS' | 'VENCIMENTO_SEGUNDAS_FERIAS' | 'AFASTADOS' | 'PERIODO_EXPERIENCIA' | TipoMarcoLimiteGozo;

// Os avisos do Monitoramento (férias, limite de gozo, afastamento, experiência) montados a partir dos dados do Domínio.
// Alimentam o relatório em PDF. (O envio automático por WhatsApp/e-mail foi removido -- vem uma nova metodologia.)
interface AvisoMontado {
  tipo: TipoAvisoDominio;
  chave: string;
  codiEmp: number;
  empresaNome: string;
  funcionarioNome: string;
  resumo: string;
}

export function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

// Destaque (*texto*) nos dados do aviso -- funcionário, datas e prazos --, no formato de negrito dos modelos de texto.
const neg = (v: string | number) => `*${String(v).replace(/\*/g, '')}*`;
const negData = (iso: string | null | undefined) => neg(fmtData(iso));

/** Dias de hoje (data de São Paulo, ou `hoje` AAAA-MM-DD) até a data `iso`; negativo = já passou. */
export function diasAte(iso: string, hoje: string = dataEmSaoPaulo(new Date())): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const [ha, hm, hd] = hoje.split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000);
}

/**
 * Monta a lista de avisos "brutos" a partir do que o Monitoramento mostra na
 * tela -- mesmos 5 grupos, mesmas regras, de TODAS as empresas (quem chama
 * filtra por codiEmp depois). Função pura (sem I/O) pra poder testar sem
 * banco nem Domínio de verdade.
 */
export function montarAvisos(dados: MonitoramentoDominio): AvisoMontado[] {
  const avisos: AvisoMontado[] = [];

  for (const it of dados.podemTirarFerias) {
    const base = { codiEmp: it.codiEmp, empresaNome: it.empresa, funcionarioNome: it.nome };
    avisos.push({
      ...base,
      tipo: 'PODEM_TIRAR_FERIAS',
      chave: `${it.nome}:${it.fimAquisitivo}`,
      resumo: `${neg(it.nome)} (${it.empresa}) pode tirar férias — período encerrado em ${negData(it.fimAquisitivo)}, prazo pra conceder até ${negData(it.limiteParaGozo)} (${it.diasPendentes} dia(s) pendente(s)).`,
    });
    // limite de gozo: alertas em 3 marcos (90, 60 e 30 dias) -- ver marcos-limite-gozo.ts
    const dias = it.limiteParaGozo ? diasAte(it.limiteParaGozo) : null;
    const marco = dias === null ? null : marcoLimiteGozo(dias);
    if (marco && dias !== null) {
      const situacao =
        dias < 0
          ? `o prazo de gozo de férias de ${neg(it.nome)} (${it.empresa}) venceu há ${neg(-dias)} dia(s), em ${negData(it.limiteParaGozo)}`
          : `faltam ${neg(dias)} dia(s) pro limite de gozo de férias de ${neg(it.nome)} (${it.empresa}), em ${negData(it.limiteParaGozo)}`;
      avisos.push({
        ...base,
        tipo: marco,
        chave: `${it.nome}:${it.fimAquisitivo}`,
        resumo: `URGENTE: ${situacao} — depois disso a empresa é obrigada a pagar em dobro.`,
      });
    }
  }

  for (const it of dados.vencimentoSegundasFerias) {
    avisos.push({
      codiEmp: it.codiEmp,
      empresaNome: it.empresa,
      funcionarioNome: it.nome,
      tipo: 'VENCIMENTO_SEGUNDAS_FERIAS',
      chave: `${it.codigo ?? it.nome}:${it.vencimento}`,
      resumo: `${neg(it.nome)} (${it.empresa}) vai passar a ter um 2º período de férias completo em ${negData(it.vencimento)} — o período pendente (limite ${negData(it.limiteParaGozo)}) precisa ser gozado antes disso.`,
    });
  }

  for (const it of dados.afastados) {
    avisos.push({
      codiEmp: it.codiEmp,
      empresaNome: it.empresa,
      funcionarioNome: it.nome,
      tipo: 'AFASTADOS',
      chave: `${it.nome}:${it.inicio}`,
      resumo: `${neg(it.nome)} (${it.empresa}) está afastado(a) desde ${negData(it.inicio)} — ${it.motivo}${it.previsaoRetorno ? `, previsão de retorno em ${negData(it.previsaoRetorno)}` : ''}.`,
    });
  }

  for (const it of dados.periodoExperiencia) {
    avisos.push({
      codiEmp: it.codiEmp,
      empresaNome: it.empresa,
      funcionarioNome: it.nome,
      tipo: 'PERIODO_EXPERIENCIA',
      chave: `${it.nome}:${it.fimExperiencia}`,
      resumo: it.prorrogacaoPrevista
        ? `${neg(it.nome)} (${it.empresa}) está em período de experiência: o 1º período termina em ${negData(it.fimPrazoInicial)} (prorrogação já prevista até ${negData(it.fimExperiencia)}) — confirme a prorrogação ou a efetivação a tempo.`
        : `${neg(it.nome)} (${it.empresa}) está em período de experiência até ${negData(it.fimExperiencia)}${it.prorrogado ? ' (já prorrogado)' : ''} — decida a efetivação a tempo.`,
    });
  }

  return avisos;
}
