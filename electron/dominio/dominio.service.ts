import * as db from './db';
import * as queries from './queries';

/** Resultado de testar/reabrir a conexão com o Domínio (a tela mostra "conectado" x "desconectado" + o motivo). */
export interface StatusDominio {
  dominioOk: boolean;
  latenciaMs?: number;
  mensagem?: string;
}

export interface EmpresaDominio {
  codi_emp: number;
  nome_emp: string;
  fantasia_emp: string | null;
  cgce_emp: string | null;
  razao_emp: string | null;
  ende_emp: string | null;
  nume_emp: number | null;
  comp_emp: string | null;
  bair_emp: string | null;
  cida_emp: string | null;
  esta_emp: string | null;
  cepe_emp: string | null;
  /** Situação da empresa no Domínio: 'A' = Ativa. */
  stat_emp?: string | null;
}

export interface AlertaFeriasDominio {
  codiEmp: number;
  empresa: string;
  nome: string;
  admissao: string;
  fimAquisitivo?: string;
  limiteParaGozo?: string;
  diasPendentes?: number;
  periodosPendentes?: number;
  codigo?: number;
  vencimento?: string;
}

export interface AlertaAfastadoDominio {
  codiEmp: number;
  empresa: string;
  nome: string;
  motivo: string;
  inicio: string;
  previsaoRetorno: string | null;
}

export interface AlertaExperienciaDominio {
  codiEmp: number;
  empresa: string;
  nome: string;
  admissao: string;
  /** Fim real do contrato: a prorrogação, quando houver, senão o fim do prazo inicial. */
  fimExperiencia: string;
  fimPrazoInicial: string;
  /** 1 = a prorrogação JÁ ACONTECEU: o prazo inicial terminou e o contrato seguiu até fimExperiencia. */
  prorrogado: number;
  /** 1 = a prorrogação está só cadastrada (o Domínio já guarda o contrato inteiro, ex.: 30 + 60 dias, na admissão), mas o 1º período ainda não terminou. */
  prorrogacaoPrevista?: number;
}

/** Empregado ativo que faz aniversário no mês corrente (dia/mês/ano de nascimento como números, sem fuso). */
export interface AlertaAniversarianteDominio {
  codiEmp: number;
  empresa: string;
  codigo: number;
  nome: string;
  dia: number;
  mes: number;
  ano: number;
}

export interface MonitoramentoDominio {
  podemTirarFerias: AlertaFeriasDominio[];
  vencimentoSegundasFerias: AlertaFeriasDominio[];
  afastados: AlertaAfastadoDominio[];
  periodoExperiencia: AlertaExperienciaDominio[];
  aniversariantes: AlertaAniversarianteDominio[];
}

/**
 * A consulta devolve `prorrogado = 1` sempre que a data da prorrogação (pro_praz_det) é posterior ao fim do prazo inicial. Mas o
 * Domínio já grava essa data NA ADMISSÃO (contrato de 90 dias = 30 + 60), então isso só diz que a prorrogação está
 * PREVISTA. Prorrogado de verdade = o prazo inicial já terminou. Separa os dois casos.
 */
export function normalizarExperiencia(dados: MonitoramentoDominio, hoje: string = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })): MonitoramentoDominio {
  return {
    ...dados,
    periodoExperiencia: dados.periodoExperiencia.map((e) => {
      const cadastrada = !!e.prorrogado;
      const jaAconteceu = cadastrada && !!e.fimPrazoInicial && String(e.fimPrazoInicial).slice(0, 10) < hoje;
      return { ...e, prorrogado: jaAconteceu ? 1 : 0, prorrogacaoPrevista: cadastrada && !jaAconteceu ? 1 : 0 };
    }),
  };
}

/**
 * O Domínio guarda alguns nomes com espaço sobrando no fim (ex.: "RODRIGO VIEIRA DE ARAUJO "), que aparecia como
 * "RODRIGO VIEIRA DE ARAUJO : ..." nos relatórios. Tira os espaços das pontas dos textos que viram frase.
 */
export function limparEspacos(dados: MonitoramentoDominio): MonitoramentoDominio {
  const limpa = <T extends { nome: string; empresa: string }>(lista: T[]): T[] => lista.map((x) => ({ ...x, nome: x.nome.trim(), empresa: x.empresa.trim() }));
  return {
    podemTirarFerias: limpa(dados.podemTirarFerias),
    vencimentoSegundasFerias: limpa(dados.vencimentoSegundasFerias),
    afastados: limpa(dados.afastados).map((a) => ({ ...a, motivo: (a.motivo ?? '').trim() })),
    periodoExperiencia: limpa(dados.periodoExperiencia),
    aniversariantes: limpa(dados.aniversariantes ?? []),
  };
}

export interface ParametrosConexao {
  user: string;
  password: string;
  /** Nome de uma conexão ODBC (DSN) já configurada no Windows; com ela, usuário e senha podem ficar vazios. */
  dsn?: string;
  driver?: string;
  server?: string;
  database?: string;
  host?: string;
}

/**
 * Acesso ao banco do Domínio (somente leitura) direto do processo principal do Electron -- no lugar da ponte HTTP
 * (dominio-bridge) + backend do módulo folha.
 */
export class DominioService {
  private conectado = false;

  /** Abre a conexão com as credenciais informadas e confirma que o Domínio responde. */
  async conectar(p: ParametrosConexao): Promise<StatusDominio> {
    await db.fechar();
    this.limparCaches();
    db.definirConexao({ user: p.user, password: p.password, dsn: p.dsn ?? '', ...(p.driver && { driver: p.driver }), ...(p.server && { server: p.server }), ...(p.database && { database: p.database }), ...(p.host && { host: p.host }) });
    return this.verificar();
  }

  async desconectar(): Promise<void> {
    this.conectado = false;
    this.limparCaches();
    await db.fechar();
  }

  get estaConectado() { return this.conectado; }

  /** Nunca lança: transforma qualquer falha num StatusDominio pra tela mostrar o motivo. */
  async verificar(): Promise<StatusDominio> {
    try {
      const latenciaMs = await db.verificar();
      this.conectado = true;
      return { dominioOk: true, latenciaMs };
    } catch (err) {
      this.conectado = false;
      return { dominioOk: false, mensagem: mensagemAmigavel(err) };
    }
  }

  async reconectar(): Promise<StatusDominio> {
    try {
      const latenciaMs = await db.reconectar();
      this.conectado = true;
      return { dominioOk: true, latenciaMs };
    } catch (err) {
      this.conectado = false;
      return { dominioOk: false, mensagem: mensagemAmigavel(err) };
    }
  }

  private exigirConexao() {
    if (!this.conectado) throw new Error('Sem conexão com o Domínio. Entre na tela Conexão e conecte primeiro.');
  }

  private limparCaches() {
    this.nomesEmpresas = null;
  }

  async listarEmpresas(): Promise<EmpresaDominio[]> {
    this.exigirConexao();
    return queries.listarEmpresas();
  }

  // A lista inteira (~2.700 empresas) é cara pra buscar a cada relatório, então o nome/CNPJ ficam em memória por 10 min.
  // Também guarda a promessa: vários PDFs em paralelo esperam a mesma busca.
  private nomesEmpresas: { em: number; dados: Promise<{ mapa: Map<number, string>; cnpjs: Map<number, string | null> }> } | null = null;
  private carregarNomes() {
    if (!this.nomesEmpresas || Date.now() - this.nomesEmpresas.em > 10 * 60 * 1000) {
      const dados = this.listarEmpresas().then((lista) => ({
        mapa: new Map(lista.map((e) => [e.codi_emp, (e.razao_emp || e.nome_emp).trim()] as [number, string])),
        cnpjs: new Map(lista.map((e) => [e.codi_emp, (e.cgce_emp ?? '').trim() || null] as [number, string | null])),
      }));
      const entrada = { em: Date.now(), dados };
      this.nomesEmpresas = entrada;
      dados.catch(() => { if (this.nomesEmpresas === entrada) this.nomesEmpresas = null; });
    }
    return this.nomesEmpresas.dados;
  }
  async nomeEmpresa(codiEmp: number): Promise<string | null> {
    try {
      return (await this.carregarNomes()).mapa.get(codiEmp) ?? null;
    } catch {
      return null; // sem o nome o relatório ainda sai, só com o código
    }
  }
  /** CNPJ (só dígitos) da empresa, do mesmo cache de 10 min do nome. */
  async cnpjEmpresa(codiEmp: number): Promise<string | null> {
    try {
      return (await this.carregarNomes()).cnpjs.get(codiEmp) ?? null;
    } catch {
      return null;
    }
  }

  async monitoramento(): Promise<MonitoramentoDominio> {
    this.exigirConexao();
    const [podemTirarFerias, vencimentoSegundasFerias, afastados, periodoExperiencia, aniversariantes] = await Promise.all([
      queries.podemTirarFerias(),
      queries.vencimentoSegundasFerias(),
      queries.afastados(),
      queries.periodoExperiencia(),
      queries.aniversariantes(),
    ]);
    return normalizarExperiencia(limparEspacos({ podemTirarFerias, vencimentoSegundasFerias, afastados, periodoExperiencia, aniversariantes }));
  }
}

// Traduz os erros mais comuns do driver ODBC e tira o prefixo técnico "[SAP][ODBC Driver][SQL Anywhere]".
function mensagemAmigavel(err: unknown): string {
  const texto = err instanceof Error ? err.message : String(err);
  const odbc = err as { odbcErrors?: { message?: string }[] };
  const bruta = (odbc?.odbcErrors?.[0]?.message || texto || '').replace(/^(\[[^\]]*\])+\s*/, '').trim();
  if (/invalid user id or password/i.test(bruta)) return 'Usuário ou senha inválidos. Confira os dados do banco do Domínio.';
  if (/server not found|unable to connect to database server|database server not found/i.test(bruta)) return 'Não encontrei o servidor do Domínio. Confira a rede/VPN e o endereço em Avançado.';
  if (/data source name not found/i.test(bruta)) return 'Fonte de dados ODBC não encontrada neste PC.';
  return bruta || 'O Domínio não respondeu.';
}