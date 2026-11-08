import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as db from './dominio/db';
import { DominioService } from './dominio/dominio.service';
import { ErroValidacao, ModelosRelatorio, SalvarModelo } from './relatorio/modelos';
import { ListasEmpresas } from './relatorio/listas';
import { RelatorioService } from './relatorio/relatorio.service';
import { textoDeDocx } from './relatorio/importar-docx';
import { exemploRelatorio } from './relatorio/exemplo';
import { gerarPdf } from './relatorio/relatorio-pdf';
import { APARENCIA_PADRAO, AparenciaStore, ErroAparencia, validarAparencia } from './relatorio/aparencia';
import { validarCorpoTemplate } from './relatorio/template.util';
import { LIMITE_CORPO_TEMPLATE, TEXTO_PADRAO_RELATORIO, VARIAVEIS_RELATORIO } from './relatorio/template.util';

// Só uma janela: abrir de novo traz a que já existe pra frente (duas instâncias disputariam o mesmo arquivo de modelos).
if (!app.requestSingleInstanceLock()) app.quit();

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ICONE = path.join(__dirname, '..', 'build', 'icon.ico');

// ---------- preferências (só o que vale lembrar: usuário do banco e pasta de destino; a senha nunca é gravada) ----------
interface DadosServidor { driver?: string; server?: string; database?: string; host?: string }
interface Preferencias { usuario?: string; pasta?: string; /** servidor do Domínio já usado com sucesso (nunca a senha) */ servidor?: DadosServidor }
const arquivoPreferencias = () => path.join(app.getPath('userData'), 'config.json');

function lerPreferencias(): Preferencias {
  try { return JSON.parse(fs.readFileSync(arquivoPreferencias(), 'utf8')); } catch { return {}; }
}
function gravarPreferencias(novas: Preferencias) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(arquivoPreferencias(), JSON.stringify({ ...lerPreferencias(), ...novas }), 'utf8');
  } catch { /* é só conveniência: sem isso a preferência é pedida de novo */ }
}

function driverOdbcInstalado(driver: string): boolean {
  try {
    execSync(`reg query "HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI\\${driver}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Conexões ODBC (DSN) do Windows que usam o driver do SQL Anywhere (a mesma conexão que outros sistemas do escritório usam).
function listarDsns(): string[] {
  const nomes = new Set<string>();
  for (const raiz of ['HKLM\\SOFTWARE\\ODBC\\ODBC.INI', 'HKCU\\SOFTWARE\\ODBC\\ODBC.INI']) {
    try {
      const saida = execSync(`reg query "${raiz}" /s`, { encoding: 'latin1', stdio: ['ignore', 'pipe', 'ignore'] });
      let atual = '';
      for (const linha of saida.split(/\r?\n/)) {
        if (/^HKEY_/i.test(linha)) atual = linha.slice(linha.lastIndexOf('\\') + 1).trim();
        else if (atual && /^\s+Driver\s+REG_SZ\s+.*dbodbc/i.test(linha)) nomes.add(atual);
      }
    } catch { /* chave inexistente neste PC */ }
  }
  return [...nomes].sort();
}

// Endereço (host:porta) do banco do Domínio que o PC já conhece: sai das conexões ODBC do SQL Anywhere (campo Host ou
// CommLinks "TCPIP{host=...; serverport=...}"), pra o usuário não precisar digitar. Vazio se não achar nenhuma.
function servidorDasConexoesOdbc(): string {
  const raizes = ['HKLM\\SOFTWARE\\ODBC\\ODBC.INI', 'HKLM\\SOFTWARE\\WOW6432Node\\ODBC\\ODBC.INI', 'HKCU\\SOFTWARE\\ODBC\\ODBC.INI'];
  for (const raiz of raizes) {
    let saida = '';
    try { saida = execSync(`reg query "${raiz}" /s`, { encoding: 'latin1', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { continue; }
    let sql = false, host = '', comm = '', porta = '';
    const fecha = () => {
      if (!sql) return '';
      if (host) return host;
      const m = /host\s*=\s*([^;}\s]+)/i.exec(comm);
      if (!m) return '';
      const p = /serverport\s*=\s*(\d+)/i.exec(comm)?.[1] ?? (/^\d+$/.test(porta) ? porta : '2638');
      return `${m[1]}:${p}`;
    };
    for (const linha of [...saida.split(/\r?\n/), 'HKEY_FIM']) {
      if (/^HKEY_/i.test(linha)) {
        const achou = fecha();
        if (achou) return achou;
        sql = false; host = ''; comm = ''; porta = '';
        continue;
      }
      const v = /^\s+(\w+)\s+REG_SZ\s+(.*)$/.exec(linha);
      if (!v) continue;
      const chave = v[1].toLowerCase(), valor = v[2].trim();
      if (chave === 'driver' && /dbodbc/i.test(valor)) sql = true;
      else if (chave === 'host') host = valor;
      else if (chave === 'commlinks') comm = valor;
      else if (chave === 'porta') porta = valor;
    }
  }
  return '';
}
// ---------- serviços ----------
const dominio = new DominioService();
let modelos: ModelosRelatorio;
let aparencia: AparenciaStore;
let listas: ListasEmpresas;
let relatorio: RelatorioService;

function codigo(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isInteger(n)) throw new ErroValidacao('codiEmp inválido.');
  return n;
}
function modeloId(valor: unknown): string | undefined {
  if (!valor) return undefined;
  if (typeof valor !== 'string' || !REGEX_UUID.test(valor)) throw new ErroValidacao('modeloId inválido.');
  return valor;
}

// Cada canal devolve { ok, dados } ou { ok:false, erro }: o preload transforma de volta em retorno/exceção, sem o prefixo
// "Error invoking remote method" que o Electron põe nas exceções.
function registrar(canal: string, tratador: (...args: any[]) => unknown | Promise<unknown>) {
  ipcMain.handle(canal, async (_evento, ...args) => {
    try {
      return { ok: true, dados: await tratador(...args) };
    } catch (err) {
      return { ok: false, erro: err instanceof Error ? err.message : String(err) };
    }
  });
}

function registrarCanais() {
  // conexão
  // `padrao` = o último servidor que conectou neste PC (ou o padrão do Domínio, sem endereço: cada escritório tem o seu)
  registrar('conexao:carregar', () => ({ usuario: lerPreferencias().usuario ?? '', padrao: { ...db.PADRAO, ...lerPreferencias().servidor, host: lerPreferencias().servidor?.host || servidorDasConexoesOdbc() }, conectado: dominio.estaConectado }));
  registrar('conexao:dsns', () => listarDsns());
  registrar('conexao:conectar', async (p: { usuario?: string; senha?: string; lembrar?: boolean; dsn?: string; driver?: string; server?: string; database?: string; host?: string }) => {
    if (p.dsn) {
      // conexão ODBC já configurada no Windows (usuário e senha guardados nela): só aceita uma que exista de verdade
      if (!listarDsns().includes(p.dsn)) throw new ErroValidacao(`A conexão ODBC "${p.dsn}" não existe neste PC.`);
      return dominio.conectar({ user: '', password: '', dsn: p.dsn });
    }
    if (!p.usuario || !p.senha) throw new ErroValidacao('Informe usuário e senha.');
    const driver = p.driver || db.PADRAO.driver;
    if (!driverOdbcInstalado(driver)) throw new ErroValidacao(`Driver ODBC "${driver}" não está instalado neste PC. Use o botão "Instalar driver ODBC" abaixo.`);
    const host = (p.host ?? '').trim() || servidorDasConexoesOdbc();
    if (!host) throw new ErroValidacao('Informe o servidor do Domínio no campo "Servidor do Domínio" (endereço:porta, ex.: 192.168.0.10:2638).');
    gravarPreferencias({ usuario: p.lembrar ? p.usuario : '' });
    const status = await dominio.conectar({ user: p.usuario, password: p.senha, driver: p.driver, server: p.server, database: p.database, host });
    if (status.dominioOk) gravarPreferencias({ servidor: { driver: p.driver, server: p.server, database: p.database, host } }); // lembra o servidor, nunca a senha
    return status;
  });  // Abre numa janela do PowerShell o script que instala o driver ODBC (ele mesmo pede permissão de administrador).
  registrar('driver:instalar', () => {
    const script = app.isPackaged ? path.join(process.resourcesPath, 'instalar-driver-odbc.ps1') : path.join(__dirname, '..', 'scripts', 'instalar-driver-odbc.ps1');
    if (!fs.existsSync(script)) throw new ErroValidacao('Script de instalação do driver não encontrado.');
    // `start` abre uma janela de console nova e visível (um spawn "detached" direto roda o PowerShell sem janela nenhuma)
    spawn('cmd.exe', ['/c', `start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${script}"`], { stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
    return { ok: true };
  });
  registrar('conexao:desconectar', async () => { await dominio.desconectar(); return { ok: true }; });
  // Conexão que já estava aberta e morreu (máquina dormiu, rede caiu): reabre sozinha uma vez, sem botão pro usuário apertar.
  registrar('dominio:status', async () => {
    if (!dominio.estaConectado) return { dominioOk: false, mensagem: 'Sem conexão: informe usuário e senha na tela Conexão.' };
    const status = await dominio.verificar();
    return status.dominioOk ? status : dominio.reconectar();
  });
  registrar('dominio:empresas', () => dominio.listarEmpresas());

  // modelos do texto
  registrar('modelos:listar', () => ({ modelos: modelos.listar(), variaveis: VARIAVEIS_RELATORIO, limiteCaracteres: LIMITE_CORPO_TEMPLATE, textoPadraoEmbutido: TEXTO_PADRAO_RELATORIO }));
  registrar('modelos:criar', (dto: SalvarModelo) => modelos.criar(dto));
  registrar('modelos:atualizar', (id: string, dto: SalvarModelo) => modelos.atualizar(modeloId(id)!, dto));
  // Abre um .docx do Word e devolve o texto (com *negrito*/_itálico_ e as {{variáveis}} digitadas no documento) pro editor.
  registrar('modelos:importar-docx', async () => {
    const janela = BrowserWindow.getFocusedWindow() ?? undefined;
    const opcoes = { title: 'Importar modelo do Word', filters: [{ name: 'Documento do Word', extensions: ['docx', 'doc'] }], properties: ['openFile'] as 'openFile'[] };
    const r = janela ? await dialog.showOpenDialog(janela, opcoes) : await dialog.showOpenDialog(opcoes);
    if (r.canceled || !r.filePaths[0]) return null;
    return { nome: path.basename(r.filePaths[0]).replace(/\.docx?$/i, ''), corpo: await textoDeDocx(r.filePaths[0]) };
  });
  // Pré-visualização do PDF (devolve o arquivo em base64 pra tela desenhar): com o texto que está no editor, sem salvar,
  // usando uma empresa fictícia com todos os tipos de alerta.
  // `aparenciaEmEdicao` (opcional) = o que está na aba Aparência ainda sem salvar; sem ele vale a aparência salva.
  registrar('modelos:previa-pdf', async (corpo: unknown, aparenciaEmEdicao?: unknown) => {
    let texto: string | null = null;
    if (typeof corpo === 'string' && corpo.trim()) {
      const erro = validarCorpoTemplate(corpo, VARIAVEIS_RELATORIO);
      if (erro) throw new ErroValidacao(erro);
      texto = corpo;
    }
    const ap = aparenciaEmEdicao ? validarAparencia(aparenciaEmEdicao) : aparencia.obter();
    return (await gerarPdf(exemploRelatorio(texto ?? modelos.padrao()?.corpo ?? null, ap.contatoAjuda), ap)).toString('base64');
  });

  // aparência do relatório (logo, marca d'água, rodapé e cores): uma só por instalação
  registrar('aparencia:obter', () => ({ aparencia: aparencia.obter(), personalizada: aparencia.personalizada(), padrao: APARENCIA_PADRAO }));
  registrar('aparencia:salvar', (ap: unknown) => aparencia.salvar(ap));
  registrar('aparencia:restaurar', () => aparencia.restaurar());
  // Abre o seletor de imagem e devolve o arquivo como data URL (só PNG e JPEG, até 3 MB) -- é o que o PDF consegue desenhar.
  registrar('aparencia:escolher-imagem', async (titulo: unknown) => {
    const janela = BrowserWindow.getFocusedWindow() ?? undefined;
    const opcoes = { title: typeof titulo === 'string' ? titulo : 'Escolher imagem', filters: [{ name: 'Imagem PNG ou JPEG', extensions: ['png', 'jpg', 'jpeg'] }], properties: ['openFile'] as 'openFile'[] };
    const r = janela ? await dialog.showOpenDialog(janela, opcoes) : await dialog.showOpenDialog(opcoes);
    if (r.canceled || !r.filePaths[0]) return null;
    const arquivo = r.filePaths[0];
    const tamanho = fs.statSync(arquivo).size;
    if (tamanho > 3 * 1024 * 1024) throw new ErroValidacao('A imagem passa de 3 MB. Reduza o arquivo e tente de novo.');
    const tipo = /\.png$/i.test(arquivo) ? 'png' : 'jpeg';
    return `data:image/${tipo};base64,${fs.readFileSync(arquivo).toString('base64')}`;
  });
  registrar('modelos:excluir', (id: string) => { modelos.excluir(modeloId(id)!); return { ok: true }; });

  // relatórios
  registrar('relatorio:previa', (codiEmp: unknown, modelo: unknown) => relatorio.montar(codigo(codiEmp), undefined, modeloId(modelo)));
  // Pré-visualização do PDF real da empresa (mesmos dados do Domínio e mesmo modelo que o "Salvar PDF" usa).
  registrar('relatorio:pdf-previa', async (codiEmp: unknown, modelo: unknown) => (await relatorio.pdf(codigo(codiEmp), modeloId(modelo))).buffer.toString('base64'));
  registrar('relatorio:ativas', async () => {
    const empresas = await relatorio.empresasAtivasDetalhe();
    return { total: empresas.length, empresas };
  });
  registrar('relatorio:com-prazos', async (meses: unknown) => {
    if (meses !== 3 && meses !== 6) throw new ErroValidacao('Período inválido.');
    return { codiEmps: await relatorio.empresasComPrazoEm(meses) };
  });
  registrar('relatorio:com-avisos', async () => ({ codiEmps: await relatorio.empresasComAvisos() }));

  // listas de empresas montadas pelo usuário (ex.: a carteira de cada pessoa do escritório); os PDFs saem na mesma pasta de destino
  registrar('listas:listar', () => listas.listar());
  registrar('listas:salvar', (dto: { id?: string; nome: unknown; empresas: unknown }) => listas.salvar(dto));
  registrar('listas:excluir', (id: unknown) => { listas.excluir(String(id)); return { ok: true }; });

  // pasta de destino dos PDFs
  registrar('pasta:atual', () => {
    const pasta = lerPreferencias().pasta;
    return pasta && fs.existsSync(pasta) ? { caminho: pasta, nome: path.basename(pasta) || pasta } : null;
  });
  registrar('pasta:escolher', async () => {
    const janela = BrowserWindow.getFocusedWindow() ?? undefined;
    const opcoes = { title: 'Pasta de destino dos PDFs', defaultPath: lerPreferencias().pasta, properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] };
    const r = janela ? await dialog.showOpenDialog(janela, opcoes) : await dialog.showOpenDialog(opcoes);
    if (r.canceled || !r.filePaths[0]) return null;
    gravarPreferencias({ pasta: r.filePaths[0] });
    return { caminho: r.filePaths[0], nome: path.basename(r.filePaths[0]) || r.filePaths[0] };
  });
  registrar('pasta:abrir', async () => {
    const pasta = lerPreferencias().pasta;
    if (pasta) await shell.openPath(pasta);
    return { ok: true };
  });

  // Gera o PDF da empresa e grava: na pasta de destino (lote ou "Salvar PDF na pasta") ou, sem pasta, pergunta onde salvar.
  registrar('pdf:salvar', async (codiEmp: unknown, modelo: unknown, usarPasta: boolean) => {
    const { buffer, nomeArquivo } = await relatorio.pdf(codigo(codiEmp), modeloId(modelo));
    const pasta = usarPasta ? lerPreferencias().pasta : undefined;
    let destino: string;
    if (pasta) {
      if (!fs.existsSync(pasta)) throw new ErroValidacao('A pasta de destino não existe mais — escolha a pasta de novo.');
      destino = path.join(pasta, nomeArquivo);
    } else {
      const janela = BrowserWindow.getFocusedWindow() ?? undefined;
      const opcoes = { title: 'Salvar relatório em PDF', defaultPath: path.join(app.getPath('documents'), nomeArquivo), filters: [{ name: 'PDF', extensions: ['pdf'] }] };
      const r = janela ? await dialog.showSaveDialog(janela, opcoes) : await dialog.showSaveDialog(opcoes);
      if (r.canceled || !r.filePath) return null;
      destino = r.filePath;
    }
    await fs.promises.writeFile(destino, buffer);
    return { nome: path.basename(destino), pasta: path.dirname(destino) };
  });
}

// ---------- janela ----------
let janelaPrincipal: BrowserWindow | null = null;

function criarJanela() {
  janelaPrincipal = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Prazos',
    icon: ICONE,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const urlDev = process.env.RELATORIOS_DEV_URL;
  if (urlDev) janelaPrincipal.loadURL(urlDev);
  else janelaPrincipal.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // links externos abrem no navegador do Windows, nunca dentro do app
  janelaPrincipal.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  janelaPrincipal.on('closed', () => { janelaPrincipal = null; });
}

app.on('second-instance', () => {
  if (janelaPrincipal) {
    if (janelaPrincipal.isMinimized()) janelaPrincipal.restore();
    janelaPrincipal.focus();
  }
});

// O app já se chamou "JVS Prazos" e "Relatórios Domínio": traz usuário lembrado, pasta de destino e modelos da pasta antiga,
// se a nova ainda não tem os arquivos.
function migrarDadosAntigos() {
  try {
    const destino = app.getPath('userData');
    for (const antigo of ['JVS Prazos', 'Relatórios Domínio']) {
      const origem = path.join(app.getPath('appData'), antigo);
      if (origem === destino || !fs.existsSync(origem)) continue;
      for (const arquivo of ['config.json', 'modelos-relatorio.json']) {
        const de = path.join(origem, arquivo);
        const para = path.join(destino, arquivo);
        if (fs.existsSync(de) && !fs.existsSync(para)) {
          fs.mkdirSync(destino, { recursive: true });
          fs.copyFileSync(de, para);
        }
      }
    }
  } catch { /* migrar é só conveniência */ }
}

app.whenReady().then(() => {
  migrarDadosAntigos();
  Menu.setApplicationMenu(null);
  modelos = new ModelosRelatorio(path.join(app.getPath('userData'), 'modelos-relatorio.json'));
  aparencia = new AparenciaStore(path.join(app.getPath('userData'), 'aparencia.json'));
  listas = new ListasEmpresas(path.join(app.getPath('userData'), 'listas-empresas.json'));
  relatorio = new RelatorioService(modelos, dominio, () => aparencia.obter());
  registrarCanais();
  criarJanela();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) criarJanela(); });
});

app.on('window-all-closed', () => { app.quit(); });
app.on('before-quit', () => { void dominio.desconectar(); });
