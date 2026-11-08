import { DadosRelatorio, formatarCnpj } from './relatorio-pdf';
import { renderizarTemplate } from './template.util';

const fmt = (d: Date) => d.toLocaleDateString('pt-BR');
const em = (dias: number) => new Date(Date.now() + dias * 86400000);

/**
 * Relatório de uma empresa FICTÍCIA com todos os tipos de alerta, pra pré-visualizar como um modelo de texto fica no PDF
 * sem precisar de conexão com o Domínio. `corpo` = texto do modelo (null = PDF sem texto de abertura).
 */
export function exemploRelatorio(corpo: string | null, contatoAjuda = ''): DadosRelatorio {
  const hoje = new Date();
  const data = fmt(hoje);
  const cnpj = '12345678000199';
  const empresa = 'EMPRESA EXEMPLO LTDA';
  const avisos = [
    '• *MARIA APARECIDA SOUZA* (EMPRESA EXEMPLO LTDA) pode tirar férias — prazo pra conceder até *' + fmt(em(45)) + '*.',
    '• *FERNANDA COSTA* (EMPRESA EXEMPLO LTDA) está em período de experiência: o 1º período termina em *' + fmt(em(12)) + '*.',
    '• *ROBERTO NUNES* (EMPRESA EXEMPLO LTDA) está afastado(a) desde *' + fmt(em(-20)) + '*.',
  ];
  const mensagem =
    corpo === null
      ? null
      : renderizarTemplate(corpo, { id: '101', cnpj: formatarCnpj(cnpj), empresa, avisos: avisos.join('\n'), quantidade: String(avisos.length), data });

  return {
    empresa,
    codiEmp: 101,
    cnpj,
    emissao: data,
    geradoEm: `${data} ${hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    mensagem,
    totais: [
      { rotulo: 'Férias com risco (até 90 dias)', valor: 2, urgente: true },
      { rotulo: 'Prazos regulares de férias', valor: 2 },
      { rotulo: 'Contratos de experiência', valor: 1 },
      { rotulo: 'Afastados', valor: 1 },
      { rotulo: '2º período de férias', valor: 1 },
      { rotulo: 'Aniversariantes do mês', valor: 2 },
    ],
    criticos: [
      { nome: 'MARIA APARECIDA SOUZA', diasPendentes: '30', periodoEncerrado: fmt(em(-320)), prazoLimite: fmt(em(45)), faltam: 45, segundoPeriodo: fmt(em(45)) },
      { nome: 'CARLOS EDUARDO LIMA', diasPendentes: '30', periodoEncerrado: fmt(em(-340)), prazoLimite: fmt(em(25)), faltam: 25, segundoPeriodo: null },
    ],
    regulares: [
      { nome: 'JOÃO PEDRO ALVES', periodoEncerrado: fmt(em(-150)), prazoLimite: fmt(em(215)), diasPendentes: '30' },
      { nome: 'ANA PAULA RIBEIRO', periodoEncerrado: fmt(em(-90)), prazoLimite: fmt(em(275)), diasPendentes: '30' },
    ],
    contratos: [
      {
        nome: 'FERNANDA COSTA',
        descricao: `O 1º período do contrato de experiência termina em *${fmt(em(12))}* (a prorrogação já prevista vai até *${fmt(em(72))}*).`,
        acao: 'Confirme a prorrogação ou a efetivação, pois o 1º período vence em 12 dias.',
      },
    ],
    afastados: [{ nome: 'ROBERTO NUNES', motivo: 'Doença período superior a 15 dias', inicio: fmt(em(-20)), retorno: fmt(em(25)) }],
    segundoPeriodo: [{ nome: 'PATRÍCIA GOMES', vencimento: fmt(em(60)), limite: fmt(em(30)) }],
    aniversariantes: [
      { nome: 'PAULO HENRIQUE DIAS', data: '08/11', idade: 34, hoje: false, jaPassou: false },
      { nome: 'LUCIANA MARTINS', data: '21/11', idade: 41, hoje: false, jaPassou: false },
    ],
    contatoAjuda: contatoAjuda.trim() || null,
  };
}
