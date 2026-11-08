// Reels vertical (9:16, 1080x1920) do Prazos, no estilo dos reels do NFS-e Download: título em cima, GRAVAÇÃO REAL do app
// no meio (dados fictícios do preload-demo.js) e a marca embaixo, fechando com "Como baixar". Vídeo mudo, MP4 padrão.
// Uso (depois de "npm run build" e do bundle do pdf-exemplo):
//   npx esbuild scripts/demo/mp4-encoder.js --bundle --format=iife --outfile=scripts/demo/.build/mp4-encoder.js
//   electron scripts/demo/gravar-instagram.js <pasta-de-saida>
// Env: PRAZOS_GITHUB = endereço do repositório que aparece no "Como baixar".
const { app, BrowserWindow, ipcMain } = require('electron');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const path = require('node:path');

const saida = process.argv[process.argv.length - 1];
const raiz = path.resolve(__dirname, '..', '..');
const pagina = fs.readFileSync(path.join(__dirname, 'demo-page.js'), 'utf8');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const GITHUB = process.env.PRAZOS_GITHUB || 'github.com/JoaoVitorSantosGitHub/Prazos';

const W = 1080;
const ALTURA_APP = 1330;
const TOPO = 300;

ipcMain.handle('demo:pdf', (_e, corpo, ap) => require('./.build/pdf-exemplo.js').gerar(corpo, ap));
ipcMain.handle('demo:padrao', () => require('./.build/pdf-exemplo.js').padrao());
ipcMain.handle('demo:imagem', (_e, titulo) => {
  const pasta = path.join(raiz, 'documentacao', 'exemplo-papel-timbrado');
  const nome = /logo/i.test(titulo) ? 'logo.png' : /marca/i.test(titulo) ? 'marca-dagua.png' : 'rodape.jpg';
  return `data:image/${nome.endsWith('.png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(path.join(pasta, nome)).toString('base64')}`;
});

app.whenReady().then(async () => {
  const w = new BrowserWindow({
    width: W, height: ALTURA_APP, useContentSize: true, enableLargerThanScreen: true, x: -3000, y: 0, frame: false, show: true, focusable: false, skipTaskbar: true, title: 'Prazos', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload-demo.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  w.setContentSize(W, ALTURA_APP);
  await w.loadFile(path.join(raiz, 'dist', 'index.html'));
  await w.webContents.executeJavaScript("try { localStorage.setItem('jvs-tema', 'neon'); localStorage.removeItem('sidebar-colapsada'); } catch {}", true);
  w.webContents.reload();
  await new Promise((r) => w.webContents.once('did-finish-load', r));
  await esperar(1200);
  const exec = (js) => w.webContents.executeJavaScript(js, true);
  await exec(pagina);

  const dirQuadros = path.join(app.getPath('temp'), 'prazos-quadros-ig');
  fs.rmSync(dirQuadros, { recursive: true, force: true });
  fs.mkdirSync(dirQuadros, { recursive: true });
  const quadros = [];
  const cenas = [];
  let capturando = true;
  let tam = null;
  const T0 = Date.now();
  const laco = (async () => {
    let n = 0;
    while (capturando) {
      const ini = Date.now();
      const img = await w.webContents.capturePage();
      if (!tam) tam = img.getSize();
      const arq = path.join(dirQuadros, `${String(n++).padStart(6, '0')}.jpg`);
      fs.writeFileSync(arq, img.toJPEG(90));
      quadros.push({ u: pathToFileURL(arq).href, t: ini - T0 });
      const gasto = Date.now() - ini;
      if (gasto < 60) await esperar(60 - gasto);
    }
  })();
  await esperar(600);

  // cada cena: rótulo e título no topo, ações no app e um tempo mínimo na tela (o vídeo é mudo: dá tempo de ler)
  const cena = async (rotulo, titulo, minimo, acoes) => {
    const t0 = Date.now() - T0;
    try { await acoes(); } catch (e) { console.log('AVISO cena', rotulo, e.message); }
    const gasto = Date.now() - T0 - t0;
    if (gasto < minimo) await esperar(minimo - gasto);
    cenas.push({ rotulo, titulo, t0, t1: Date.now() - T0, tipo: 'app' });
  };

  await cena('Conexão', 'Conecte ao Domínio em um clique', 6500, async () => {
    await esperar(900);
    await exec("demo.digitar('#senha', 'senha-do-banco', 90)");
    await exec("demo.clicar('Conectar')");
    await exec("demo.aguardar('Relatorio de prazos')");
    await esperar(900);
  });

  await cena('Alertas', 'Os alertas de cada empresa', 8500, async () => {
    await exec("demo.digitar('input[placeholder^=\"Busque\"]', 'padaria')");
    await exec("demo.clicar('PADARIA PAO NOSSO')");
    await exec("demo.aguardar('.border-l-destructive')");
    await esperar(1000);
    await exec("demo.rolar('main', 420, 1400)");
    await esperar(1000);
    await exec("demo.rolar('main', 900, 1400)");
    await esperar(900);
  });

  await cena('PDF', 'PDF pronto em um clique', 8000, async () => {
    await exec("demo.rolar('main', 0, 600)");
    await exec("demo.clicar('Pre-visualizar PDF')");
    await exec("demo.aguardar('canvas')");
    await esperar(2600);
    await exec("document.querySelector('[role=dialog] .overflow-y-auto').scrollTo({ top: 700, behavior: 'smooth' })");
    await esperar(2300);
    await exec("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
    await esperar(700);
  });

  await cena('Em lote', 'Todas as empresas de uma vez', 8500, async () => {
    await exec("demo.rolar('main', 0, 500)");
    await exec("demo.clicar('Em lote')");
    await esperar(500);
    await exec("demo.clicar('Escolher as empresas')");
    await exec("demo.clicar('Com avisos hoje')");
    await esperar(1000);
    await exec("demo.clicar('Prazos em 3 meses')");
    await esperar(1300);
  });

  await cena('Listas', 'Uma lista para cada pessoa', 9500, async () => {
    await exec("demo.clicar('Salvar como lista')");
    await exec("demo.digitar('input[aria-label=\"Nome da nova lista\"]', 'Carteira da Carla', 80)");
    await exec("demo.clicar('Salvar lista')");
    await esperar(1200);
    await exec("demo.clicar('Uma das minhas listas')");
    await esperar(800);
    await exec("(() => { const el = document.getElementById('lista-lote'); const op = [...el.options].find((o) => /Ana/.test(o.textContent)); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, op.value); el.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await esperar(1500);
  });

  await cena('Sua marca', 'Com a cara do seu escritório', 10000, async () => {
    await exec("demo.rolar('main', 0, 500)");
    await exec("demo.clicar('Aparencia do PDF')");
    await esperar(1200);
    await exec("demo.clicar('Escolher imagem', 'main')");
    await esperar(600);
    await exec("demo.clicar('Escolher imagem', 'main')");
    await esperar(600);
    await exec("demo.clicar('Imagem', 'main')");
    await esperar(400);
    await exec("demo.clicar('Escolher imagem', 'main')");
    await esperar(1500);
    await exec("(() => { const el = document.querySelectorAll('main input[type=color]')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '#0B3D91'); el.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await esperar(1800);
  });

  capturando = false;
  await laco;
  cenas[0].t0 = 0;
  const tFim = cenas[cenas.length - 1].t1;
  cenas.push({
    rotulo: 'Como baixar', titulo: 'Instalação em 3 passos', t0: tFim, t1: tFim + 5500, tipo: 'fim',
  });
  console.log('quadros', quadros.length, 'cenas', cenas.map((c) => `${c.rotulo} ${((c.t1 - c.t0) / 1000).toFixed(1)}s`).join(' | '), 'tamanho', JSON.stringify(tam));

  const enc = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { webSecurity: false, backgroundThrottling: false } });
  await enc.loadFile(path.join(__dirname, 'encoder-mp4.html'));
  const cfg = {
    w: W, h: 1920, fps: 30, bitrate: 6_000_000, topo: TOPO, alturaApp: ALTURA_APP,
    marca: 'Prazos', tagline: 'Relatório de vencimentos · Férias · Experiência',
    icone: pathToFileURL(path.join(raiz, 'build', 'icon.png')).href,
    quadros, cenas,
    fim: {
      rotulo: 'Como baixar', titulo: 'Instalação em 3 passos', subtitulo: 'Como instalar',
      passos: [
        { t: 'Abra o GitHub', sub: GITHUB },
        { t: 'Clique em Releases', sub: 'e baixe o arquivo Prazos_Setup.exe' },
        { t: 'Instale e abra o app', sub: 'Windows · conexão com o Domínio' },
      ],
    },
  };
  const r = await enc.webContents.executeJavaScript(`codificarMp4(${JSON.stringify(cfg)})`, true);
  fs.mkdirSync(saida, { recursive: true });
  const arquivo = path.join(saida, 'prazos-instagram.mp4');
  fs.writeFileSync(arquivo, Buffer.alloc(0));
  const FATIA = 3 * 1024 * 1024;
  for (let i = 0; i < r.bytes; i += FATIA) {
    fs.appendFileSync(arquivo, Buffer.from(await enc.webContents.executeJavaScript(`pegarParteMp4(${i}, ${FATIA})`, true), 'base64'));
  }
  console.log('video', arquivo, fs.statSync(arquivo).size, 'bytes,', r.quadros, 'quadros a 30 fps');
  app.quit();
});
