import { trechos, formatarCnpj } from './relatorio-pdf';
import { acaoContrato, acaoPrimeiroPeriodo, empresasComPrazoAte, maisMeses, maisUmAno, montarContrato, nomeArquivoEmpresa } from './relatorio.service';
import { limparEspacos, normalizarExperiencia } from '../dominio/dominio.service';
import { montarAniversariantes } from './aniversarios';

describe('trechos (formatação do WhatsApp no PDF)', () => {
  it('negrito, itálico e normal', () => {
    expect(trechos('Olá *ACME* e _isto_ ok')).toEqual([
      { texto: 'Olá ', negrito: false, italico: false },
      { texto: 'ACME', negrito: true, italico: false },
      { texto: ' e ', negrito: false, italico: false },
      { texto: 'isto', negrito: false, italico: true },
      { texto: ' ok', negrito: false, italico: false },
    ]);
  });
  it('underscore no meio da palavra não vira itálico', () => {
    expect(trechos('arquivo_final_v2')).toEqual([{ texto: 'arquivo_final_v2', negrito: false, italico: false }]);
  });
});

describe('formatarCnpj', () => {
  it('formata 14 dígitos; outro tamanho ou vazio fica como veio', () => {
    expect(formatarCnpj('12345678000199')).toBe('12.345.678/0001-99');
    expect(formatarCnpj('123')).toBe('123');
    expect(formatarCnpj(null)).toBe('—');
  });
});

describe('nomeArquivoEmpresa (ID - CNPJ - RAZÃO SOCIAL)', () => {
  it('monta o nome com os três dados', () => {
    expect(nomeArquivoEmpresa(627, '12345678000199', 'INDUSTRIA EXEMPLO LTDA')).toBe('627 - 12345678000199 - INDUSTRIA EXEMPLO LTDA.pdf');
  });
  it('documento só com espaços (cadastro em branco no Domínio) vira SEM CNPJ', () => {
    expect(nomeArquivoEmpresa(38, '              ', 'EMPRESA TESTE ONVIO')).toBe('38 - SEM CNPJ - EMPRESA TESTE ONVIO.pdf');
  });
  it('tira o que o Windows não aceita no nome de arquivo e trata CNPJ ausente', () => {
    expect(nomeArquivoEmpresa(1, null, 'A/B: "C" <D>?*|')).toBe('1 - SEM CNPJ - A B C D.pdf');
  });
});
describe('maisUmAno (2º período aquisitivo = fim do período + 1 ano)', () => {
  it('soma um ano mantendo dia e mês', () => {
    expect(maisUmAno('2025-12-20')).toBe('2026-12-20');
    expect(maisUmAno('2026-01-31')).toBe('2027-01-31');
  });
  it('29/02 vai pra 28/02 quando o ano seguinte não é bissexto', () => {
    expect(maisUmAno('2024-02-29')).toBe('2025-02-28');
  });
});
describe('acaoContrato (texto do alerta de contrato)', () => {
  it('amanhã e hoje pedem decisão imediata', () => {
    expect(acaoContrato(1)).toBe('Necessária decisão imediata sobre a efetivação, pois vence amanhã.');
    expect(acaoContrato(0)).toBe('Necessária decisão imediata sobre a efetivação, pois vence hoje.');
  });
  it('poucos dias, muitos dias e vencido', () => {
    expect(acaoContrato(7)).toBe('Necessária decisão sobre a efetivação, pois vence em 7 dias.');
    expect(acaoContrato(40)).toBe('Necessária decisão sobre a efetivação antes dessa data.');
    expect(acaoContrato(-3)).toMatch(/já terminou/);
  });
});
describe('contrato de experiência: prorrogação PREVISTA x prorrogado de verdade', () => {
  const base = { codiEmp: 402, empresa: 'X', nome: 'ANDERSON', admissao: '2026-10-03' };

  it('normalizarExperiencia: pro_praz_det cadastrada mas 1º período ainda rodando = só prevista', () => {
    const dados = {
      podemTirarFerias: [], vencimentoSegundasFerias: [], afastados: [], aniversariantes: [],
      periodoExperiencia: [
        { ...base, fimPrazoInicial: '2026-11-01', fimExperiencia: '2026-12-31', prorrogado: 1 }, // admitido há 13 dias: prevista
        { ...base, nome: 'ALENCAR', fimPrazoInicial: '2026-09-11', fimExperiencia: '2026-11-10', prorrogado: 1 }, // 1º período já terminou: prorrogado
        { ...base, nome: 'JEAN', fimPrazoInicial: '2026-10-20', fimExperiencia: '2026-10-20', prorrogado: 0 }, // sem prorrogação
      ],
    };
    const [prevista, real, sem] = normalizarExperiencia(dados, '2026-10-16').periodoExperiencia;
    expect([prevista.prorrogado, prevista.prorrogacaoPrevista]).toEqual([0, 1]);
    expect([real.prorrogado, real.prorrogacaoPrevista]).toEqual([1, 0]);
    expect([sem.prorrogado, sem.prorrogacaoPrevista]).toEqual([0, 0]);
  });

  it('montarContrato: prevista fala do fim do 1º período (e de até onde vai a prorrogação), sem dizer "já prorrogado"', () => {
    const c = montarContrato({ ...base, fimPrazoInicial: '2026-11-01', fimExperiencia: '2026-12-31', prorrogado: 0, prorrogacaoPrevista: 1 }, '2026-10-16');
    expect(c.descricao).toBe('O 1º período do contrato de experiência termina em *01/11/2026* (a prorrogação já prevista vai até *31/12/2026*).');
    expect(c.descricao).not.toMatch(/já prorrogado/);
    expect(c.acao).toBe('Confirme a prorrogação ou a efetivação antes dessa data.'); // faltam 16 dias
    expect(c.proximoPrazo).toBe('2026-11-01');
  });

  it('montarContrato: prorrogado de verdade e contrato simples', () => {
    const real = montarContrato({ ...base, fimPrazoInicial: '2026-09-11', fimExperiencia: '2026-11-10', prorrogado: 1, prorrogacaoPrevista: 0 }, '2026-10-16');
    expect(real.descricao).toBe('O período de experiência (já prorrogado) finaliza em *10/11/2026*.');
    expect(real.proximoPrazo).toBe('2026-11-10');
    const simples = montarContrato({ ...base, fimPrazoInicial: '2026-10-17', fimExperiencia: '2026-10-17', prorrogado: 0, prorrogacaoPrevista: 0 }, '2026-10-16');
    expect(simples.descricao).toBe('O período de experiência finaliza em *17/10/2026*.');
    expect(simples.acao).toBe('Necessária decisão imediata sobre a efetivação, pois vence amanhã.');
  });

  it('acaoPrimeiroPeriodo', () => {
    expect(acaoPrimeiroPeriodo(0)).toMatch(/hoje/);
    expect(acaoPrimeiroPeriodo(1)).toMatch(/amanhã/);
    expect(acaoPrimeiroPeriodo(9)).toBe('Confirme a prorrogação ou a efetivação, pois o 1º período vence em 9 dias.');
  });
});
describe('limparEspacos (nomes do Domínio com espaço sobrando)', () => {
  it('tira os espaços das pontas de nome, empresa e motivo, sem mexer no resto', () => {
    const base = { codiEmp: 402, admissao: '2026-10-02' };
    const r = limparEspacos({
      podemTirarFerias: [], vencimentoSegundasFerias: [], aniversariantes: [{ codiEmp: 402, empresa: 'PATRIC ', codigo: 7, nome: 'MARIA ', dia: 21, mes: 10, ano: 1990 }],
      afastados: [{ ...base, nome: 'ELIAS ', empresa: ' PATRIC ', motivo: 'Doença ', inicio: '2026-08-12', previsaoRetorno: null }],
      periodoExperiencia: [{ ...base, nome: 'RODRIGO VIEIRA DE ARAUJO ', empresa: 'PATRIC', fimPrazoInicial: '2026-10-31', fimExperiencia: '2026-10-31', prorrogado: 0 }],
    });
    expect(r.periodoExperiencia[0].nome).toBe('RODRIGO VIEIRA DE ARAUJO');
    expect(r.afastados[0]).toMatchObject({ nome: 'ELIAS', empresa: 'PATRIC', motivo: 'Doença', inicio: '2026-08-12' });
    expect(r.aniversariantes[0]).toMatchObject({ nome: 'MARIA', empresa: 'PATRIC' });
  });
  it('ponte antiga (sem o grupo de aniversariantes) não derruba: vira lista vazia', () => {
    const antigo = { podemTirarFerias: [], vencimentoSegundasFerias: [], afastados: [], periodoExperiencia: [] } as unknown as Parameters<typeof limparEspacos>[0];
    expect(limparEspacos(antigo).aniversariantes).toEqual([]);
  });
});
describe('montarAniversariantes (aniversariantes do mês de uma empresa)', () => {
  const a = (nome: string, dia: number, mes: number, ano: number) => ({ codiEmp: 1, empresa: 'X', codigo: 1, nome, dia, mes, ano });
  it('ordena por dia, calcula a idade e marca o de hoje e os que já passaram', () => {
    const r = montarAniversariantes([a('ZELIA', 30, 10, 1980), a('BRUNA', 21, 10, 1995), a('ANA', 5, 10, 2000), a('CARLA', 21, 10, 1970)], '2026-10-21');
    expect(r.map((x) => x.nome)).toEqual(['ANA', 'BRUNA', 'CARLA', 'ZELIA']);
    expect(r[0]).toEqual({ nome: 'ANA', data: '05/10', idade: 26, hoje: false, jaPassou: true });
    expect(r[1]).toMatchObject({ data: '21/10', idade: 31, hoje: true, jaPassou: false });
    expect(r[3]).toMatchObject({ idade: 46, hoje: false, jaPassou: false });
  });
  it('quem não é do mês de hoje fica de fora (resposta em cache na virada do mês)', () => {
    expect(montarAniversariantes([a('X', 31, 10, 1990), a('Y', 1, 11, 1990)], '2026-11-01').map((x) => x.nome)).toEqual(['Y']);
  });
});
describe('maisMeses', () => {
  it('soma meses e limita o dia ao último do mês de destino', () => {
    expect(maisMeses('2026-11-05', 3)).toBe('2027-02-05');
    expect(maisMeses('2026-08-31', 6)).toBe('2027-02-28');
    expect(maisMeses('2026-12-15', 6)).toBe('2027-06-15');
  });
});

describe('empresasComPrazoAte (atalhos "prazos em 3 / 6 meses")', () => {
  const base = { empresa: 'X', nome: 'N', admissao: '2020-01-01' };
  const dados: any = {
    podemTirarFerias: [
      { ...base, codiEmp: 5, limiteParaGozo: '2027-01-10' },
      { ...base, codiEmp: 7, limiteParaGozo: '2027-09-01' },
    ],
    vencimentoSegundasFerias: [{ ...base, codiEmp: 3, vencimento: '2027-01-30', limiteParaGozo: '2027-12-01' }],
    afastados: [{ ...base, codiEmp: 99, motivo: 'm', inicio: '2026-10-01', previsaoRetorno: '2026-12-01' }],
    periodoExperiencia: [
      { ...base, codiEmp: 8, fimExperiencia: '2027-04-01', fimPrazoInicial: '2026-12-20', prorrogado: 0, prorrogacaoPrevista: 1 },
      { ...base, codiEmp: 9, fimExperiencia: '2027-08-01', fimPrazoInicial: '2027-08-01', prorrogado: 0, prorrogacaoPrevista: 0 },
    ],
    aniversariantes: [{ codiEmp: 98, empresa: 'X', codigo: 1, nome: 'A', dia: 1, mes: 11, ano: 1990 }],
  };
  it('3 meses: pega férias, 2º período e o 1º período do contrato com prorrogação prevista', () => {
    expect(empresasComPrazoAte(dados, '2027-02-05')).toEqual([3, 5, 8]);
  });
  it('6 meses inclui os prazos mais longos; afastados e aniversariantes nunca entram', () => {
    expect(empresasComPrazoAte(dados, '2027-05-05')).toEqual([3, 5, 8]);
    expect(empresasComPrazoAte(dados, '2027-09-05')).toEqual([3, 5, 7, 8, 9]);
  });
});
