const { query } = require('./db');

// Empregado "ativo" = o campo "Situação" que aparece no cadastro do
// empregado no Domínio (ex: "Demitido em 01/08/2026") NÃO é uma coluna
// direta -- é derivado do status mais recente em FOAFASTAMENTOS (mesma
// tabela/lógica usada em afastados() abaixo). i_afastamentos=8 = "Demitido".
// Comparado contra a alternativa óbvia (ausência de linha em forescisoes,
// a tabela de cálculo de rescisão): dos ~12.900 empregados no banco, essa
// checagem pega 71 casos a mais de gente já demitida (que nunca teve uma
// rescisão calculada no sistema, então "sumia" da outra checagem) e não
// perde nenhum caso -- é estritamente mais precisa, validado com os dados
// reais do banco antes de trocar.
const ATIVO = `NOT EXISTS (
    SELECT 1 FROM bethadba.FOAFASTAMENTOS af
    WHERE af.codi_emp = e.codi_emp AND af.i_empregados = e.i_empregados
      AND af.i_afastamentos = 8
      AND af.data_real = (
          SELECT MAX(af2.data_real) FROM bethadba.FOAFASTAMENTOS af2
          WHERE af2.codi_emp = e.codi_emp AND af2.i_empregados = e.i_empregados AND af2.data_real <= CURRENT DATE
      )
)`;

// "Trabalhando" = o status mais recente (FOAFASTAMENTOS, data_real <= hoje) é
// i_afastamentos=1. Fica de fora quem está demitido, de férias ou afastado por
// qualquer motivo. Quem não tem nenhuma linha em FOAFASTAMENTOS conta como
// trabalhando (mesma leitura do ATIVO acima). Usado na importação de
// funcionários pro Apontamento -- lá só faz sentido quem está na ativa.
const TRABALHANDO = `NOT EXISTS (
    SELECT 1 FROM bethadba.FOAFASTAMENTOS af
    WHERE af.codi_emp = e.codi_emp AND af.i_empregados = e.i_empregados
      AND af.i_afastamentos <> 1
      AND af.data_real = (
          SELECT MAX(af2.data_real) FROM bethadba.FOAFASTAMENTOS af2
          WHERE af2.codi_emp = e.codi_emp AND af2.i_empregados = e.i_empregados AND af2.data_real <= CURRENT DATE
      )
)`;

// Monitoramento só considera empresa com stat_emp = 'A' (Ativa) -- os outros
// status (I=Inativa, C=Em Constituição, M=Ativo sem movimento, B=Em baixa,
// E=Excluindo) ficam de fora, por pedido explícito. Nenhuma empresa é
// descartada pelo nome (nem "TESTE"/"EXEMPLO"), também por pedido explícito.
const EMPRESA_ATIVA = `emp.stat_emp = 'A'`;

// "Períodos completos em aberto" só considera período aquisitivo cujo
// limite_para_gozo caiu nos últimos 5 anos -- coincide com a prescrição
// trabalhista (CLT): reclamar de férias não concedidas há mais de 5 anos já
// nem é mais cobrável na Justiça do Trabalho, e casos de 10-15+ anos atrás
// costumam ser cadastro que ficou parado (ex: afastamento nunca encerrado),
// não obrigação real em aberto.
const CORTE_PRESCRICAO = `fa.limite_para_gozo >= DATEADD(YEAR, -5, CURRENT DATE)`;

async function listarEmpresas() {
    return query(`
        SELECT codi_emp, nome_emp, fantasia_emp, cgce_emp, razao_emp,
               ende_emp, nume_emp, comp_emp, bair_emp, cida_emp, esta_emp, cepe_emp,
               stat_emp -- situação no Domínio: 'A' = Ativa (os relatórios em lote usam só essas)
        FROM bethadba.geempre
        ORDER BY nome_emp
    `);
}


// Período aquisitivo completo (data_fim já passou), ainda dentro do prazo
// concessivo (limite_para_gozo não passou) e com saldo de dias não gozados.
async function podemTirarFerias() {
    return query(`
        SELECT emp.codi_emp AS codiEmp, emp.razao_emp AS empresa, e.nome, e.admissao,
               fa.data_fim AS fimAquisitivo, fa.limite_para_gozo AS limiteParaGozo,
               (fa.dias_direito - fa.dias_gozados) AS diasPendentes
        FROM bethadba.FOFERIAS_AQUISITIVOS fa
        JOIN bethadba.foempregados e ON e.codi_emp = fa.codi_emp AND e.i_empregados = fa.i_empregados
        JOIN bethadba.geempre emp ON emp.codi_emp = fa.codi_emp
        WHERE fa.situacao IN (1, 2)
          AND (fa.dias_direito - fa.dias_gozados) > 0
          AND fa.data_fim <= CURRENT DATE
          AND fa.limite_para_gozo >= CURRENT DATE
          AND ${ATIVO} AND ${EMPRESA_ATIVA}
        ORDER BY fa.limite_para_gozo ASC
    `);
}

// Evento "Vencimento de 2ª Férias" (mesmo nome da tela "Avisos de Vencimento"
// do Domínio): o funcionário tem 1 período completo sem gozar e o período
// aquisitivo em curso vai completar em breve -- é o momento em que ele passaria
// a ter 2 períodos completos, então o primeiro tem que ser gozado antes.
// vencimento = quando o período em curso completa; limiteParaGozo = prazo
// pra gozar o período que já está completo. Reproduz o caso da tela do
// Domínio (ex: Vencimento 08/01/2027 - Limite 10/12/2026). Quem já tem 2+
// períodos completos não entra aqui (esse evento é o aviso ANTES de acumular).
// Janela de 120 dias: o Domínio não expõe a antecedência que a tela dele usa
// (não está no banco); 120 cobre os casos do print de referência.
const JANELA_VENCIMENTO_2A_FERIAS_DIAS = 120;

async function vencimentoSegundasFerias() {
    return query(`
        SELECT * FROM (
            SELECT emp.codi_emp AS codiEmp, emp.razao_emp AS empresa, e.i_empregados AS codigo, e.nome,
                   COUNT(*) AS periodosPendentes,
                   SUM(fa.dias_direito - fa.dias_gozados) AS diasPendentes,
                   MIN(fa.limite_para_gozo) AS limiteParaGozo,
                   (SELECT MIN(fn.data_fim) FROM bethadba.FOFERIAS_AQUISITIVOS fn
                    WHERE fn.codi_emp = e.codi_emp AND fn.i_empregados = e.i_empregados
                      AND fn.situacao = 1 AND fn.data_inicio <= CURRENT DATE AND fn.data_fim > CURRENT DATE) AS vencimento
            FROM bethadba.FOFERIAS_AQUISITIVOS fa
            JOIN bethadba.foempregados e ON e.codi_emp = fa.codi_emp AND e.i_empregados = fa.i_empregados
            JOIN bethadba.geempre emp ON emp.codi_emp = fa.codi_emp
            WHERE fa.situacao IN (1, 2)
              AND (fa.dias_direito - fa.dias_gozados) > 0
              AND fa.data_fim <= CURRENT DATE
              AND ${CORTE_PRESCRICAO}
              AND ${ATIVO} AND ${EMPRESA_ATIVA}
            GROUP BY emp.codi_emp, emp.razao_emp, e.codi_emp, e.i_empregados, e.nome
        ) t
        WHERE t.periodosPendentes = 1 AND t.vencimento IS NOT NULL
          AND t.vencimento <= DATEADD(DAY, ${JANELA_VENCIMENTO_2A_FERIAS_DIAS}, CURRENT DATE)
        ORDER BY t.vencimento ASC
    `);
}

// FOAFASTAMENTOS é um histórico de status do vínculo (inclui "Trabalhando"
// e "Demitido" como status, não só afastamentos de verdade) -- por isso
// pega o status MAIS RECENTE de cada funcionário e só considera afastado se
// esse status for um motivo real de ausência (exclui 1=Trabalhando,
// 8=Demitido, 9=Férias -- férias já tem seção própria no dashboard).
async function afastados() {
    return query(`
        SELECT emp.codi_emp AS codiEmp, emp.razao_emp AS empresa, e.nome, t.descricao AS motivo,
               af.data_real AS inicio, af.data_fim AS previsaoRetorno
        FROM bethadba.foempregados e
        JOIN bethadba.geempre emp ON emp.codi_emp = e.codi_emp
        JOIN bethadba.FOAFASTAMENTOS af
          ON af.codi_emp = e.codi_emp AND af.i_empregados = e.i_empregados
          AND af.data_real = (
              SELECT MAX(af2.data_real) FROM bethadba.FOAFASTAMENTOS af2
              WHERE af2.codi_emp = e.codi_emp AND af2.i_empregados = e.i_empregados AND af2.data_real <= CURRENT DATE
          )
        LEFT JOIN bethadba.FOAFASTAMENTOS_TIPOS t ON t.i_afastamentos = af.i_afastamentos
        WHERE af.i_afastamentos NOT IN (1, 8, 9)
          AND (af.data_fim IS NULL OR af.data_fim >= CURRENT DATE)
          AND ${ATIVO} AND ${EMPRESA_ATIVA}
        ORDER BY af.data_real DESC
    `);
}

// contr_exper=1 (contrato de experiência) e o prazo determinado ainda não
// terminou. O fim real é a prorrogação (pro_praz_det, quando existe e é
// posterior) -- só olhar fim_praz_det (fim do prazo inicial) escondia quem
// estava prorrogado, ex: 30 dias até 15/07 + 60 de prorrogação até 13/09.
const FIM_EXPERIENCIA = `CASE WHEN e.pro_praz_det > e.fim_praz_det THEN e.pro_praz_det ELSE e.fim_praz_det END`;

async function periodoExperiencia() {
    return query(`
        SELECT emp.codi_emp AS codiEmp, emp.razao_emp AS empresa, e.nome, e.admissao,
               ${FIM_EXPERIENCIA} AS fimExperiencia,
               e.fim_praz_det AS fimPrazoInicial,
               CASE WHEN e.pro_praz_det > e.fim_praz_det THEN 1 ELSE 0 END AS prorrogado
        FROM bethadba.foempregados e
        JOIN bethadba.geempre emp ON emp.codi_emp = e.codi_emp
        WHERE e.contr_exper = 1
          AND ${FIM_EXPERIENCIA} >= CURRENT DATE
          AND ${ATIVO} AND ${EMPRESA_ATIVA}
        ORDER BY ${FIM_EXPERIENCIA} ASC
    `);
}

// Aniversariantes do mês corrente: empregados (CATEGORIA_ESOCIAL_EMPREGADO preenchida -- sócios com pró-labore ficam de
// fora) ainda ativos, de empresas ativas. Dia/mês/ano vêm como números do próprio banco (DAY/MONTH/YEAR) em vez da data
// crua, pra um fuso horário da máquina não empurrar o aniversário pro dia anterior/seguinte.
async function aniversariantes() {
    return query(`
        SELECT emp.codi_emp AS codiEmp, emp.razao_emp AS empresa, e.i_empregados AS codigo, e.nome,
               DAY(e.data_nascimento) AS dia, MONTH(e.data_nascimento) AS mes, YEAR(e.data_nascimento) AS ano
        FROM bethadba.foempregados e
        JOIN bethadba.geempre emp ON emp.codi_emp = e.codi_emp
        WHERE e.data_nascimento IS NOT NULL
          AND e.CATEGORIA_ESOCIAL_EMPREGADO IS NOT NULL
          AND MONTH(e.data_nascimento) = MONTH(CURRENT DATE)
          AND ${ATIVO} AND ${EMPRESA_ATIVA}
        ORDER BY DAY(e.data_nascimento), e.nome
    `);
}

module.exports = {
    listarEmpresas,
    podemTirarFerias,
    vencimentoSegundasFerias,
    afastados,
    periodoExperiencia,
    aniversariantes,
};
