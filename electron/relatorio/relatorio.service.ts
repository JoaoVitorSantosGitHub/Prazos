import { AlertaExperienciaDominio, DominioService, MonitoramentoDominio } from '../dominio/dominio.service';
import { ModelosRelatorio } from './modelos';
import { renderizarTemplate } from './template.util';
import { dataEmSaoPaulo } from './horario.util';
import { diasAte, fmtData, montarAvisos } from './avisos-dominio';
import { marcoLimiteGozo } from './marcos-limite-gozo';
import { DadosRelatorio, formatarCnpj, gerarPdf } from './relatorio-pdf';
import { montarAniversariantes } from './aniversarios';
import { Aparencia, APARENCIA_PADRAO } from './aparencia';

export interface ContextoRelatorio {
  dados: MonitoramentoDominio;
  modeloCorpo: string | null;
}

/** Nome do arquivo de cada empresa: "ID - CNPJ - RAZÃO SOCIAL.pdf" (CNPJ só com dígitos; sem caracteres que o Windows proíbe). */
export function nomeArquivoEmpresa(codiEmp: number, cnpj: string | null, razaoSocial: string): string {
  cnpj = cnpj?.trim() || null; // só espaços = sem documento
  const razao = razaoSocial.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'SEM NOME';
  return `${codiEmp} - ${cnpj || 'SEM CNPJ'} - ${razao}.pdf`;
}
/**
 * O que fazer com um contrato de experiência, conforme faltam poucos dias -- mesmo tom do relatório-modelo:
 * "Necessária decisão imediata sobre a efetivação, pois vence amanhã."
 */
export function acaoContrato(diasRestantes: number): string {
  if (diasRestantes < 0) return 'O prazo já terminou: regularize a situação contratual do colaborador.';
  if (diasRestantes === 0) return 'Necessária decisão imediata sobre a efetivação, pois vence hoje.';
  if (diasRestantes === 1) return 'Necessária decisão imediata sobre a efetivação, pois vence amanhã.';
  if (diasRestantes <= 15) return `Necessária decisão sobre a efetivação, pois vence em ${diasRestantes} dias.`;
  return 'Necessária decisão sobre a efetivação antes dessa data.';
}

/**
 * O que fazer quando o 1º período do contrato de experiência está perto do fim e a prorrogação já está prevista no cadastro
 * (o Domínio grava o contrato inteiro, ex.: 30 + 60 dias, na admissão): confirmar a prorrogação ou efetivar.
 */
export function acaoPrimeiroPeriodo(diasRestantes: number): string {
  if (diasRestantes <= 0) return 'Confirme a prorrogação ou a efetivação hoje, pois o 1º período vence hoje.';
  if (diasRestantes === 1) return 'Confirme a prorrogação ou a efetivação, pois o 1º período vence amanhã.';
  if (diasRestantes <= 15) return `Confirme a prorrogação ou a efetivação, pois o 1º período vence em ${diasRestantes} dias.`;
  return 'Confirme a prorrogação ou a efetivação antes dessa data.';
}

/**
 * Um contrato de experiência no relatório. Três situações, que NÃO são a mesma coisa:
 *  - só um período (sem prorrogação cadastrada): finaliza na data do prazo inicial;
 *  - prorrogação PREVISTA (cadastrada, mas o 1º período ainda não terminou): o prazo que importa agora é o fim do 1º período;
 *  - já prorrogado (o 1º período terminou e o contrato seguiu): finaliza na data da prorrogação.
 * `proximoPrazo` (AAAA-MM-DD) é a data que ordena a lista: a mais próxima de cada contrato.
 */
export function montarContrato(e: AlertaExperienciaDominio, hoje?: string): { nome: string; descricao: string; acao: string; proximoPrazo: string } {
  const dias = (iso: string) => diasAte(iso, hoje);
  if (e.prorrogacaoPrevista) {
    return {
      nome: e.nome,
      descricao: `O 1º período do contrato de experiência termina em *${fmtData(e.fimPrazoInicial)}* (a prorrogação já prevista vai até *${fmtData(e.fimExperiencia)}*).`,
      acao: acaoPrimeiroPeriodo(dias(e.fimPrazoInicial)),
      proximoPrazo: e.fimPrazoInicial,
    };
  }
  return {
    nome: e.nome,
    descricao: `O período de experiência${e.prorrogado ? ' (já prorrogado)' : ''} finaliza em *${fmtData(e.fimExperiencia)}*.`,
    acao: acaoContrato(dias(e.fimExperiencia)),
    proximoPrazo: e.fimExperiencia,
  };
}

/** AAAA-MM-DD + 1 ano (29/02 vira 28/02 em ano não bissexto, nunca pula pra março). */
export function maisUmAno(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(a + 1, m, 0)).getUTCDate();
  return `${a + 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, ultimoDia)).padStart(2, '0')}`;
}

/** AAAA-MM-DD + `meses` meses (dia 31 num mês curto vira o último dia do mês, nunca pula pro seguinte). */
export function maisMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, ultimoDia)).padStart(2, '0')}`;
}

/**
 * Empresas (ordenadas) com algum prazo até `ate` (AAAA-MM-DD, inclusive): limite de gozo das férias, vencimento / limite do
 * 2º período e o próximo prazo do contrato de experiência (o fim do 1º período quando a prorrogação é só prevista).
 * Afastados e aniversariantes não são prazos de ação, então não entram.
 */
export function empresasComPrazoAte(dados: MonitoramentoDominio, ate: string): number[] {
  const ate10 = (v: string | null | undefined) => !!v && String(v).slice(0, 10) <= ate;
  const codis = new Set<number>();
  for (const f of dados.podemTirarFerias) if (ate10(f.limiteParaGozo)) codis.add(f.codiEmp);
  for (const s of dados.vencimentoSegundasFerias) if (ate10(s.vencimento) || ate10(s.limiteParaGozo)) codis.add(s.codiEmp);
  for (const e of dados.periodoExperiencia) if (ate10(e.prorrogacaoPrevista ? e.fimPrazoInicial : e.fimExperiencia)) codis.add(e.codiEmp);
  return [...codis].sort((a, b) => a - b);
}

function agoraFormatado(): string {
  const d = new Date();
  const data = dataEmSaoPaulo(d).split('-').reverse().join('/');
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return `${data} ${hora}`;
}

/**
 * Relatório de situação de UMA empresa: a mesma mensagem que o WhatsApp manda (modelo padrão, com TODOS os avisos de
 * hoje, não só os inéditos) mais o detalhe de cada grupo do Monitoramento. Só lê -- não enfileira nem marca nada como enviado.
 */
export class RelatorioService {
  /** `aparencia` devolve a aparência (papel timbrado, cores, contato de ajuda) escolhida pelo escritório. */
  constructor(private modelos: ModelosRelatorio, private dominioService: DominioService, private aparencia: () => Aparencia = () => APARENCIA_PADRAO) {}

  // Monitoramento do Domínio guardado por 60 s: a exportação de muitas empresas pede um PDF por vez, e cada um precisaria
  // da mesma consulta (que cobre TODAS as empresas). Só o Domínio é cacheado -- o modelo do texto é lido sempre fresco.
  // Guarda a PROMESSA (não o resultado): PDFs em paralelo que chegam enquanto a consulta roda esperam a mesma, em vez de
  // dispararem uma cada. Falha não fica no cache.
  private cacheMonitoramento: { em: number; dados: Promise<MonitoramentoDominio> } | null = null;
  private monitoramentoRecente(): Promise<MonitoramentoDominio> {
    if (!this.cacheMonitoramento || Date.now() - this.cacheMonitoramento.em > 60_000) {
      const dados = this.dominioService.monitoramento();
      const entrada = { em: Date.now(), dados };
      this.cacheMonitoramento = entrada;
      dados.catch(() => { if (this.cacheMonitoramento === entrada) this.cacheMonitoramento = null; });
    }
    return this.cacheMonitoramento.dados;
  }

  // modeloId = o escolhido na tela; sem ele (ou se foi apagado) vale o padrão; sem nenhum, só o layout padrão do PDF.
  private async contexto(modeloId?: string): Promise<ContextoRelatorio> {
    const dados = await this.monitoramentoRecente();
    const modelo = (modeloId ? this.modelos.buscar(modeloId) : null) ?? this.modelos.padrao();
    return { dados, modeloCorpo: modelo?.corpo ?? null };
  }
  async montar(codiEmp: number, ctx?: ContextoRelatorio, modeloId?: string): Promise<DadosRelatorio> {
    const { dados, modeloCorpo } = ctx ?? (await this.contexto(modeloId));
    const [nomeDominio, cnpj] = await Promise.all([this.dominioService.nomeEmpresa(codiEmp), this.dominioService.cnpjEmpresa(codiEmp)]);

    const ferias = dados.podemTirarFerias.filter((a) => a.codiEmp === codiEmp);
    const segundas = dados.vencimentoSegundasFerias.filter((a) => a.codiEmp === codiEmp);
    const afastados = dados.afastados.filter((a) => a.codiEmp === codiEmp);
    const experiencia = dados.periodoExperiencia.filter((a) => a.codiEmp === codiEmp);
    const aniversariantes = montarAniversariantes(dados.aniversariantes.filter((a) => a.codiEmp === codiEmp));
    const avisos = montarAvisos(dados).filter((a) => a.codiEmp === codiEmp);

    const empresa = nomeDominio ?? ferias[0]?.empresa ?? afastados[0]?.empresa ?? `Empresa ${codiEmp}`;
    const data = agoraFormatado();

    // Texto do modelo (a mesma mensagem do WhatsApp, só que com TODOS os avisos de hoje): só entra no PDF se há modelo
    // (o escolhido na tela ou o padrão). Sem modelo, o PDF segue só o layout padrão do Relatório de Vencimentos de Férias, Experiência e Afastamentos.
    const mensagem =
      modeloCorpo === null
        ? null
        : renderizarTemplate(modeloCorpo, {
            id: String(codiEmp),
            cnpj: formatarCnpj(cnpj),
            empresa,
            avisos: avisos.length ? avisos.map((a) => `• ${a.resumo}`).join('\n') : '• Nenhum aviso pendente no momento — a empresa está em dia.',
            quantidade: String(avisos.length),
            data: data.slice(0, 10),
          });

    // "Férias com risco" = dentro da janela de alerta do limite de gozo (90 dias, mesmo critério dos avisos); o resto é prazo regular.
    const comDias = ferias.map((f) => ({ f, dias: f.limiteParaGozo ? diasAte(f.limiteParaGozo) : null }));
    const emRisco = comDias.filter((x) => x.dias !== null && marcoLimiteGozo(x.dias) !== null).sort((a, b) => a.dias! - b.dias!);
    const regulares = comDias.filter((x) => !(x.dias !== null && marcoLimiteGozo(x.dias) !== null)).sort((a, b) => (a.f.limiteParaGozo ?? '9').localeCompare(b.f.limiteParaGozo ?? '9'));

    return {
      empresa,
      codiEmp,
      cnpj,
      emissao: data.slice(0, 10),
      geradoEm: data,
      mensagem,
      totais: [
        { rotulo: 'Férias com risco (até 90 dias)', valor: emRisco.length, urgente: true },
        { rotulo: 'Prazos regulares de férias', valor: regulares.length },
        { rotulo: 'Contratos de experiência', valor: experiencia.length },
        { rotulo: 'Afastados', valor: afastados.length },
        { rotulo: '2º período de férias', valor: segundas.length },
        { rotulo: 'Aniversariantes do mês', valor: aniversariantes.length },
      ],
      criticos: emRisco.map(({ f, dias }) => ({
        nome: f.nome,
        diasPendentes: String(f.diasPendentes ?? '—'),
        periodoEncerrado: fmtData(f.fimAquisitivo),
        prazoLimite: fmtData(f.limiteParaGozo),
        faltam: dias!,
        segundoPeriodo: f.fimAquisitivo ? fmtData(maisUmAno(f.fimAquisitivo)) : null,
      })),
      regulares: regulares.map(({ f }) => ({
        nome: f.nome,
        periodoEncerrado: fmtData(f.fimAquisitivo),
        prazoLimite: fmtData(f.limiteParaGozo),
        diasPendentes: String(f.diasPendentes ?? '—'),
      })),
      contratos: experiencia.map((e) => montarContrato(e)).sort((a, b) => a.proximoPrazo.localeCompare(b.proximoPrazo)).map(({ nome, descricao, acao }) => ({ nome, descricao, acao })),
      afastados: afastados.map((a) => ({ nome: a.nome, motivo: a.motivo, inicio: fmtData(a.inicio), retorno: a.previsaoRetorno ? fmtData(a.previsaoRetorno) : '—' })),
      segundoPeriodo: segundas.map((s) => ({ nome: s.nome, vencimento: fmtData(s.vencimento), limite: fmtData(s.limiteParaGozo) })),
      aniversariantes,
      contatoAjuda: this.aparencia().contatoAjuda.trim() || null,
    };
  }

  /** O PDF da empresa + o nome do arquivo ("ID - CNPJ - RAZÃO SOCIAL.pdf") que a tela usa ao gravar na pasta escolhida. */
  async pdf(codiEmp: number, modeloId?: string): Promise<{ buffer: Buffer; empresa: string; nomeArquivo: string }> {
    const dados = await this.montar(codiEmp, undefined, modeloId);
    return { buffer: await gerarPdf(dados, this.aparencia()), empresa: dados.empresa, nomeArquivo: nomeArquivoEmpresa(dados.codiEmp, dados.cnpj, dados.empresa) };
  }

  /** Empresas com algum prazo (férias, 2º período ou contrato de experiência) vencendo nos próximos `meses` meses. */
  async empresasComPrazoEm(meses: number): Promise<number[]> {
    const { dados } = await this.contexto();
    return empresasComPrazoAte(dados, maisMeses(dataEmSaoPaulo(new Date()), meses));
  }

  /** Empresas que têm ALGUM aviso hoje (as que valem um relatório em lote). */
  async empresasComAvisos(): Promise<number[]> {
    const { dados } = await this.contexto();
    return [...new Set(montarAvisos(dados).map((a) => a.codiEmp))].sort((a, b) => a - b);
  }

  /** Mesma lista de empresasAtivas(), já com CNPJ, razão social e o nome do arquivo de cada uma (pra a tela gravar na pasta). */
  async empresasAtivasDetalhe(): Promise<{ codiEmp: number; cnpj: string | null; razao: string; nomeArquivo: string }[]> {
    const lista = await this.dominioService.listarEmpresas();
    return lista
      .filter((e) => (e.stat_emp ?? '').trim().toUpperCase() === 'A')
      .sort((a, b) => a.codi_emp - b.codi_emp)
      .map((e) => {
        const razao = (e.razao_emp || e.nome_emp).trim();
        const cnpj = (e.cgce_emp ?? '').trim() || null; // alguns cadastros têm só espaços no documento
        return { codiEmp: e.codi_emp, cnpj, razao, nomeArquivo: nomeArquivoEmpresa(e.codi_emp, cnpj, razao) };
      });
  }
}