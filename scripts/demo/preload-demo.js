// Preload SÓ da gravação do vídeo/guia: responde no lugar do Domínio com dados 100% fictícios (nenhuma empresa real).
const { contextBridge, ipcRenderer } = require('electron');

const NOMES = [
  'PADARIA PÃO NOSSO', 'MECÂNICA SANTA RITA', 'CONSTRUTORA HORIZONTE', 'FARMÁCIA VIDA PLENA', 'TRANSPORTES RIO BRANCO', 'MERCADO DOIS IRMÃOS',
  'CLÍNICA SAÚDE & CIA', 'AUTO PEÇAS LESTE', 'ESCOLA CAMINHO CERTO', 'RESTAURANTE SABOR CASEIRO', 'ELÉTRICA LUZ FORTE', 'MÓVEIS BELA CASA',
  'LAVANDERIA ÁGUA CLARA', 'ACADEMIA MOVIMENTO', 'IMOBILIÁRIA PORTO SEGURO', 'GRÁFICA IMPRESSÃO RÁPIDA', 'AGRO CAMPO VERDE', 'HOTEL VISTA ALEGRE',
  'DISTRIBUIDORA SOL NASCENTE', 'ÓTICA OLHAR BRILHANTE', 'SERRALHERIA FORTE AÇO', 'PET SHOP AMIGO FIEL', 'CONTABILIDADE EXEMPLO', 'TECNOLOGIA PONTO DIGITAL',
];
const empresas = NOMES.map((n, i) => {
  const id = 101 + i * 7;
  const base = String(10000000 + i * 137).padStart(8, '0');
  return { codi_emp: id, nome_emp: n, fantasia_emp: n, razao_emp: `${n} LTDA`, cgce_emp: `${base}000${100 + i}`.slice(0, 14), stat_emp: 'A' };
});

const iso = (dias) => new Date(Date.now() + dias * 86400000);
const br = (d) => d.toLocaleDateString('pt-BR');

function previa(codi) {
  const e = empresas.find((x) => x.codi_emp === codi) || empresas[0];
  const k = empresas.indexOf(e);
  const criticos = k % 3 === 0 ? [
    { nome: 'MARIA APARECIDA SOUZA', diasPendentes: '30', periodoEncerrado: br(iso(-320)), prazoLimite: br(iso(45)), faltam: 45, segundoPeriodo: br(iso(45)) },
    { nome: 'CARLOS EDUARDO LIMA', diasPendentes: '30', periodoEncerrado: br(iso(-340)), prazoLimite: br(iso(25)), faltam: 25, segundoPeriodo: null },
  ] : [];
  return {
    codiEmp: e.codi_emp, empresa: e.razao_emp, cnpj: e.cgce_emp, emissao: br(new Date()), geradoEm: br(new Date()),
    mensagem: 'Relatório de situação da folha de pagamento\n\nEmpresa: *' + e.razao_emp + '*\nData: *' + br(new Date()) + '*',
    totais: [
      { rotulo: 'Férias com risco (até 90 dias)', valor: criticos.length, urgente: true },
      { rotulo: 'Prazos regulares de férias', valor: 2 },
      { rotulo: 'Contratos de experiência', valor: 1 },
      { rotulo: 'Afastados', valor: k % 4 === 0 ? 1 : 0 },
      { rotulo: '2º período de férias', valor: 0 },
      { rotulo: 'Aniversariantes do mês', valor: 2 },
    ],
    criticos,
    regulares: [
      { nome: 'JOÃO PEDRO ALVES', periodoEncerrado: br(iso(-150)), prazoLimite: br(iso(215)), diasPendentes: '30' },
      { nome: 'ANA PAULA RIBEIRO', periodoEncerrado: br(iso(-90)), prazoLimite: br(iso(275)), diasPendentes: '30' },
    ],
    contratos: [{ nome: 'FERNANDA COSTA', descricao: `O 1º período do contrato de experiência termina em *${br(iso(12))}* (a prorrogação já prevista vai até *${br(iso(72))}*).`, acao: 'Confirme a prorrogação ou a efetivação, pois o 1º período vence em 12 dias.' }],
    contatoAjuda: null,
    afastados: k % 4 === 0 ? [{ nome: 'ROBERTO NUNES', motivo: 'Doença período superior a 15 dias', inicio: br(iso(-20)), retorno: br(iso(25)) }] : [],
    segundoPeriodo: [],
    aniversariantes: [
      { nome: 'PAULO HENRIQUE DIAS', data: '08/11', idade: 34, hoje: false, jaPassou: false },
      { nome: 'LUCIANA MARTINS', data: '21/11', idade: 41, hoje: false, jaPassou: false },
    ],
  };
}

let conectado = false;
let aparenciaAtual = null;
const estadoAparencia = async () => (aparenciaAtual ??= await ipcRenderer.invoke('demo:padrao'));
const modelos = [{ id: '3f1d2c9e-0a5b-4a8e-9b1f-6a0c1d2e3f40', nome: 'Texto padrão do escritório', corpo: 'Relatório de situação da folha de pagamento\n\nEmpresa: {{empresa}}\nID {{id}} · CNPJ {{cnpj}}\nData: {{data}}\n\nAvisos ({{quantidade}}):\n{{avisos}}', padrao: true, ativo: true }];
// listas de empresas de exemplo (fictícias) pra a gravação
const listas = [
  { id: 'a1b2c3d4-0001-4000-8000-000000000001', nome: 'Carteira da Ana', empresas: [empresas[0].codi_emp, empresas[3].codi_emp, empresas[4].codi_emp, empresas[8].codi_emp], atualizadaEm: new Date().toISOString() },
  { id: 'a1b2c3d4-0002-4000-8000-000000000002', nome: 'Carteira do Bruno', empresas: [empresas[1].codi_emp, empresas[2].codi_emp, empresas[5].codi_emp, empresas[6].codi_emp, empresas[7].codi_emp], atualizadaEm: new Date().toISOString() },
];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const tratadores = {
  'conexao:carregar': async () => ({ usuario: 'consulta.prazos', padrao: { driver: 'SQL Anywhere 17', server: 'srvContabil', database: 'Contabil', host: '192.168.0.10:2638' }, conectado }),
  'conexao:conectar': async () => { await dormir(900); conectado = true; return { dominioOk: true, latenciaMs: 18 }; },
  'conexao:desconectar': async () => { conectado = false; return { ok: true }; },
  'dominio:status': async () => (conectado ? { dominioOk: true, latenciaMs: 18 } : { dominioOk: false, mensagem: 'Sem conexão: informe usuário e senha na tela Conexão.' }),
  'dominio:empresas': async () => empresas,
  'modelos:listar': async () => ({ modelos: [...modelos], variaveis: ['empresa', 'avisos', 'quantidade', 'data', 'id', 'cnpj'], limiteCaracteres: 1500, textoPadraoEmbutido: modelos[0].corpo }),
  'modelos:criar': async (dto) => { const m = { id: 'novo-' + modelos.length, ...dto }; if (dto.padrao) modelos.forEach((x) => { x.padrao = false; }); modelos.push(m); return m; },
  'modelos:atualizar': async () => ({}),
  'modelos:excluir': async () => ({ ok: true }),
  'modelos:importar-docx': async () => ({ nome: 'Modelo enviado pelo diretor', corpo: 'Prezados,\n\nSegue a situação de prazos da empresa *{{empresa}}* em {{data}}.\n\nAvisos ({{quantidade}}):\n{{avisos}}\n\nQualquer dúvida, estamos à disposição.' }),
  'relatorio:previa': async (codi) => { await dormir(350); return previa(codi); },
  'relatorio:ativas': async () => ({ total: empresas.length, empresas: empresas.map((e) => ({ codiEmp: e.codi_emp })) }),
  'relatorio:com-avisos': async () => ({ codiEmps: empresas.filter((_, i) => i % 2 === 0).map((e) => e.codi_emp) }),
  'relatorio:com-prazos': async (meses) => ({ codiEmps: empresas.filter((_, i) => (meses === 3 ? i % 4 === 0 : i % 3 === 0)).map((e) => e.codi_emp) }),
  'listas:listar': async () => [...listas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  'listas:salvar': async (dto) => {
    const l = { id: dto.id || 'lista-' + (listas.length + 1) + '-0000-0000-0000-000000000000', nome: dto.nome, empresas: dto.empresas, atualizadaEm: new Date().toISOString() };
    const i = listas.findIndex((x) => x.id === l.id);
    if (i >= 0) listas[i] = l; else listas.push(l);
    return l;
  },
  'listas:excluir': async (id) => { const i = listas.findIndex((x) => x.id === id); if (i >= 0) listas.splice(i, 1); return { ok: true }; },
  'pasta:atual': async () => ({ caminho: 'C:\\Relatorios\\PDFs Onvio', nome: 'PDFs Onvio' }),
  'pasta:escolher': async () => ({ caminho: 'C:\\Relatorios\\PDFs Onvio', nome: 'PDFs Onvio' }),
  'pasta:abrir': async () => ({ ok: true }),
  'driver:instalar': async () => ({ ok: true }),
  'modelos:previa-pdf': async (corpo, ap) => ipcRenderer.invoke('demo:pdf', corpo, ap || (await estadoAparencia())),
  'relatorio:pdf-previa': async () => ipcRenderer.invoke('demo:pdf', null, await estadoAparencia()),
  'aparencia:obter': async () => ({ aparencia: await estadoAparencia(), personalizada: false, padrao: await ipcRenderer.invoke('demo:padrao') }),
  'aparencia:salvar': async (ap) => { aparenciaAtual = ap; return ap; },
  'aparencia:restaurar': async () => { aparenciaAtual = await ipcRenderer.invoke('demo:padrao'); return aparenciaAtual; },
  'aparencia:escolher-imagem': async (titulo) => ipcRenderer.invoke('demo:imagem', titulo),
  'pdf:salvar': async (codi) => {
    await dormir(450);
    const e = empresas.find((x) => x.codi_emp === codi) || empresas[0];
    return { nome: `${e.codi_emp} - ${e.cgce_emp} - ${e.razao_emp}.pdf`, pasta: 'C:\\Relatorios\\PDFs Onvio' };
  },
};

contextBridge.exposeInMainWorld('api', {
  invocar: async (canal, ...args) => {
    const t = tratadores[canal];
    if (!t) throw new Error(`Canal sem mock: ${canal}`);
    return t(...args);
  },
});
