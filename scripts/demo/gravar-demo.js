// Grava o vídeo de uso e as capturas de tela do guia, com dados fictícios (preload-demo.js) e narração (narracao.ps1).
// A janela do app roda oculta: os quadros são capturados em JPEG e depois montados em vídeo (encoder.html) com a narração.
// Uso (depois de "npm run build" e de gerar a narração):
//   npx esbuild scripts/demo/pdf-exemplo.ts --bundle --platform=node --external:pdfkit --outfile=scripts/demo/.build/pdf-exemplo.js
//   electron scripts/demo/gravar-demo.js <pasta-com-os-wav> <pasta-de-saida>
const { app, BrowserWindow, ipcMain } = require('electron');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const path = require('node:path');

const [pastaAudio, saida] = process.argv.slice(-2);
const raiz = path.resolve(__dirname, '..', '..');
const roteiro = JSON.parse(fs.readFileSync(path.join(__dirname, 'roteiro.json'), 'utf8'));
const pagina = fs.readFileSync(path.join(__dirname, 'demo-page.js'), 'utf8');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
// gravações de tela do Gestta (feitas pelo usuário); os dados sensíveis são borrados por gestta-blur.js
const blurGestta = require('./gestta-blur.js');
const VIDEOS = {
  express: process.env.PRAZOS_VIDEO_EXPRESS || 'C:\\Users\\ti\\Videos\\Express.mp4',
  tarefa: process.env.PRAZOS_VIDEO_TAREFA || 'C:\\Users\\ti\\Videos\\Config Tarefa.mp4',
};
// PRAZOS_SO_GESTTA=1 grava só as cenas do Gestta (teste rápido, sem vídeo final: use com --sem-video)
const SO_GESTTA = !!process.env.PRAZOS_SO_GESTTA;

ipcMain.handle('demo:pdf', (_e, corpo, ap) => require('./.build/pdf-exemplo.js').gerar(corpo, ap));
ipcMain.handle('demo:padrao', () => require('./.build/pdf-exemplo.js').padrao());
// imagens de exemplo (o papel timbrado do "Escritório Exemplo", fictício) pro botão "Escolher imagem" do demo
ipcMain.handle('demo:imagem', (_e, titulo) => {
  const pasta = path.join(raiz, 'documentacao', 'exemplo-papel-timbrado');
  const nome = /logo/i.test(titulo) ? 'logo.png' : /marca/i.test(titulo) ? 'marca-dagua.png' : 'rodape.jpg';
  return `data:image/${nome.endsWith('.png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(path.join(pasta, nome)).toString('base64')}`;
});


// Monta o vídeo (mp4) a partir dos quadros e da narração, em tempo real, numa janela que existe fora da tela
// (janela oculta não gera quadros pro MediaRecorder).
async function montarVideo(cfg) {
  if (process.env.PRAZOS_TESTE) cfg = { ...cfg, quadros: cfg.quadros.filter((q) => q.t < 8000), falas: cfg.falas.slice(0, 1) };
  if (process.env.PRAZOS_MIME) cfg = { ...cfg, mime: process.env.PRAZOS_MIME };
  const wavs = roteiro.map((c) => fs.readFileSync(path.join(pastaAudio, `${c.id}.wav`)));
  const enc = new BrowserWindow({ x: process.env.PRAZOS_VISIVEL ? 0 : -2400, y: process.env.PRAZOS_VISIVEL ? 0 : -1600, width: 480, height: 320, show: true, focusable: false, skipTaskbar: true, webPreferences: { backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
  await enc.loadFile(path.join(__dirname, 'encoder.html'));
  const { mime, n, tamanhos, trilhas, quadros } = await enc.webContents.executeJavaScript(`codificar(${JSON.stringify({ ...cfg, audios: wavs.map((b) => b.toString('base64')) })})`, true);
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const arquivo = path.join(saida, `prazos-tutorial.${ext}`);
  fs.writeFileSync(arquivo, Buffer.alloc(0));
  for (let i = 0; i < n; i++) fs.appendFileSync(arquivo, Buffer.from(await enc.webContents.executeJavaScript(`pegarParte(${i})`, true), 'base64'));
  console.log('tamanhos', JSON.stringify(tamanhos), JSON.stringify(trilhas), quadros);
  console.log('audio ctx', await enc.webContents.executeJavaScript('window.estadoAudio'));
  console.log('video', mime, 'partes', n, arquivo, fs.statSync(arquivo).size);
}

if (process.argv.includes('--so-codificar')) {
  // reaproveita os quadros da última gravação (pasta temporária), sem refazer a captura
  app.whenReady().then(async () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(app.getPath('temp'), 'prazos-quadros', 'cfg.json'), 'utf8'));
    await montarVideo(cfg).catch((e) => console.log('ERRO', e.message));
    app.quit();
  });
} else
app.whenReady().then(async () => {
  const w = new BrowserWindow({
    width: 1280, height: 800, useContentSize: true, show: false, title: 'Prazos', autoHideMenuBar: true, paintWhenInitiallyHidden: true,
    webPreferences: { preload: path.join(__dirname, 'preload-demo.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  await w.loadFile(path.join(raiz, 'dist', 'index.html'));
  await w.webContents.executeJavaScript("try { localStorage.setItem('jvs-tema', 'neon'); localStorage.removeItem('sidebar-colapsada'); } catch {}", true);
  w.webContents.reload();
  await new Promise((r) => w.webContents.once('did-finish-load', r));
  await esperar(1200);

  const exec = (js) => w.webContents.executeJavaScript(js, true);
  const idx = (id) => roteiro.findIndex((c) => c.id === id);
  fs.mkdirSync(path.join(saida, 'img'), { recursive: true });
  const foto = async (nome) => {
    await esperar(350);
    await exec('demo.ocultar(true)'); // as capturas do guia saem sem a legenda e sem o cursor da gravação
    await esperar(150);
    const img = await w.webContents.capturePage();
    await exec('demo.ocultar(false)');
    fs.writeFileSync(path.join(saida, 'img', `${nome}.png`), img.toPNG());
    console.log('foto', nome);
  };

  await exec(pagina);
  const wavs = roteiro.map((c) => fs.readFileSync(path.join(pastaAudio, `${c.id}.wav`)));
  // duração = bytes de áudio / bytes por segundo (cabeçalho do .wav)
  const duracoes = wavs.map((b) => b.readUInt32LE(b.indexOf('data') + 4) / b.readUInt32LE(28));
  console.log('duracoes', duracoes.map((d) => d.toFixed(1)).join(' '));

  // captura de quadros (JPEG) em ritmo fixo, com o instante de cada um
  const dirQuadros = path.join(app.getPath('temp'), 'prazos-quadros');
  fs.rmSync(dirQuadros, { recursive: true, force: true });
  fs.mkdirSync(dirQuadros, { recursive: true });
  const quadros = [];
  const falas = [];
  let capturando = true;
  let tamanho = null;
  const T0 = Date.now();
  const laco = (async () => {
    let n = 0;
    while (capturando) {
      const ini = Date.now();
      const img = await w.webContents.capturePage();
      if (!tamanho) tamanho = img.getSize();
      const arq = path.join(dirQuadros, `${String(n++).padStart(6, '0')}.jpg`);
      fs.writeFileSync(arq, img.toJPEG(85));
      quadros.push({ u: pathToFileURL(arq).href, t: ini - T0 });
      const gasto = Date.now() - ini;
      if (gasto < 80) await esperar(80 - gasto);
    }
  })();
  await esperar(1500);

  // cada cena: legenda na tela, narração marcada na linha do tempo, ações acontecendo; só avança quando a fala termina
  const cena = async (id, acoes) => {
    if (SO_GESTTA && !/^[et]\d-/.test(id)) return;
    const i = idx(id);
    await exec(`demo.legenda(${JSON.stringify(roteiro[i].texto)})`);
    falas.push({ i, t: Date.now() - T0 });
    const falando = esperar(duracoes[i] * 1000 + 300);
    try { await acoes(); } catch (e) { console.log('AVISO cena', id, e.message); }
    await falando;
    await esperar(500);
  };

  await cena('01-intro', async () => {
    await foto('01-conexao');
    await exec("demo.destacar('nav', 2600)");
  });

  await cena('02-conexao', async () => {
    await exec("demo.digitar('#senha', 'senha-do-banco', 90)");
    await exec("demo.destacar('Lembrar usuario', 1800)");
    await exec("demo.clicar('Avancado')");
    await esperar(1600);
    await foto('02-conexao-preenchida');
    await exec("demo.clicar('Avancado')");
  });

  await cena('03-conectado', async () => {
    await exec("demo.clicar('Conectar')");
    await exec("demo.aguardar('Relatorio de prazos')");
    await esperar(800);
    await exec("demo.destacar('[role=status]', 2500)");
  });

  await cena('04-config', async () => {
    await exec("demo.destacar('[role=combobox]', 2400)");
    await exec("demo.destacar('Trocar', 2200)");
    await foto('03-relatorio-topo');
  });

  await cena('05-empresa', async () => {
    await exec("demo.digitar('input[placeholder^=\"Busque\"]', 'padaria')");
    await exec("demo.clicar('PADARIA PAO NOSSO')");
    await exec("demo.aguardar('.border-l-destructive')");
    await esperar(900);
    await foto('04-previa-topo');
    await exec("demo.rolar('main', 420, 1400)");
    await esperar(1400);
    await exec("demo.rolar('main', 900, 1400)");
    await foto('05-previa-alertas');
    await exec("demo.rolar('main', 1500, 1400)");
    await esperar(1200);
  });

  await cena('05b-previa', async () => {
    await exec("demo.clicar('Pre-visualizar PDF')");
    await exec("demo.aguardar('canvas')");
    await esperar(2500);
    await foto('06-previa-pdf');
    await exec("document.querySelector('[role=dialog] .overflow-y-auto').scrollTo({ top: 700, behavior: 'smooth' })");
    await esperar(2500);
    await exec("document.querySelector('[role=dialog] .overflow-y-auto').scrollTo({ top: 1500, behavior: 'smooth' })");
    await esperar(2500);
  });
  await exec("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  await esperar(700);

  await cena('06-salvar', async () => {
    await exec("demo.clicar('Salvar PDF na pasta')");
    await esperar(1800);
    await foto('07-pdf-salvo');
  });

  await cena('07-lote', async () => {
    await exec("demo.rolar('main', 0, 700)");
    await exec("demo.clicar('Em lote')");
    await esperar(600);
    await exec("demo.destacar('Todas as empresas ativas no Dominio', 2400)");
    await foto('08-lote');
    await exec("demo.clicar('Escolher as empresas')");
  });

  await cena('08-atalhos', async () => {
    await exec("demo.clicar('Com avisos hoje')");
    await esperar(1100);
    await exec("demo.clicar('Limpar selecao')");
    await esperar(600);
    await exec("demo.clicar('Prazos em 3 meses')");
    await esperar(1000);
    await foto('09-atalhos');
    await exec("demo.clicar('Prazos em 6 meses')");
    await esperar(1000);
  });

  await cena('08b-listas', async () => {
    await exec("demo.clicar('Salvar como lista')");
    await exec("demo.digitar('input[aria-label=\"Nome da nova lista\"]', 'Carteira da Carla', 70)");
    await esperar(500);
    await foto('21-lista-nome');
    await exec("demo.clicar('Salvar lista')");
    await esperar(1200);
    await foto('22-lista-salva');
    await exec("demo.clicar('Uma das minhas listas')");
    await esperar(900);
    // escolhe a lista "Carteira da Ana" no seletor
    await exec("(() => { const el = document.getElementById('lista-lote'); const op = [...el.options].find((o) => /Ana/.test(o.textContent)); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, op.value); el.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await esperar(1200);
    await foto('23-lista-escolhida');
  });

  await cena('09-lote-salvar', async () => {
    await exec("demo.clicar('Salvar PDFs na pasta')");
    await esperar(1800);
    await foto('10-lote-andamento');
    await esperar(5500);
    await foto('11-lote-concluido');
  });

  // ---- Gestta: Express e Tarefa, a partir das gravações de tela (com blur nos dados sensíveis) ----
  const clipe = (video, de, ate) => async () => {
    const regioes = blurGestta[video].filter((r) => r.ate > de && r.de < ate + 3); // + 3 s: o último quadro fica parado na tela, e o que vem logo depois também precisa estar borrado
    const i = idx(cenaAtual);
    await exec(`demo.clipe(${JSON.stringify({ src: pathToFileURL(VIDEOS[video]).href, de, ate, duracao: duracoes[i], regioes })})`);
  };
  let cenaAtual = '';
  const cenaVideo = (id, video, de, ate) => { cenaAtual = id; return cena(id, clipe(video, de, ate)); };
  await cenaVideo('e1-gestta', 'express', 5, 13.5);
  await cenaVideo('e2-codigo', 'express', 14.5, 28.3);
  await cenaVideo('e3-express', 'express', 29, 43);
  await cenaVideo('e4-login', 'express', 48.7, 53.2);
  await cenaVideo('e5-pasta', 'express', 55.9, 67);
  await cenaVideo('t1-onvio', 'tarefa', 5, 14);
  await cenaVideo('t2-configure', 'tarefa', 14.5, 22);
  await cenaVideo('t3-recorrentes', 'tarefa', 22, 35);
  await cenaVideo('t4-detalhes', 'tarefa', 35, 42.2);
  await cenaVideo('t5-anexos', 'tarefa', 42.2, 50);
  await cenaVideo('t6-template', 'tarefa', 50, 55.8);
  await cenaVideo('t7-validar', 'tarefa', 59, 70);
  await exec('demo.fecharClipe()');
  await esperar(500);

  await cena('10-modelos', async () => {
    await exec("demo.rolar('main', 0, 500)");
    await exec("demo.clicar('Modelos de texto')");
    await esperar(900);
    await foto('12-modelos');
    await exec("demo.clicar('+ Novo modelo')");
    await esperar(900);
    await exec("demo.clicar('Importar do Word', '[role=dialog]')");
    await esperar(1500);
    await foto('13-editor-modelo');
    await exec("demo.clicar('Pre-visualizar PDF', '[role=dialog]')");
    await exec("demo.aguardar('canvas')");
    await esperar(3000);
    await foto('14-previa-modelo');
    await exec("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
    await esperar(900);
    await exec("demo.clicar('Salvar', '[role=dialog]')");
    await esperar(1500);
  });

  await cena('10b-aparencia', async () => {
    await exec("demo.clicar('Aparencia do PDF')");
    await esperar(2200);
    await foto('17-aparencia-padrao');
    // o escritório de exemplo carrega o próprio papel timbrado: logo, marca d'água e rodapé em imagem
    await exec("demo.clicar('Escolher imagem', 'main')");
    await esperar(1200);
    await exec("demo.clicar('Escolher imagem', 'main')");
    await esperar(1200);
    await exec("demo.clicar('Imagem', 'main')");
    await esperar(800);
    await exec("demo.clicar('Escolher imagem', 'main')");
    await esperar(2500);
    await foto('18-aparencia-papel-timbrado');
    // troca uma cor: a prévia ao lado acompanha
    await exec("demo.mover(document.querySelectorAll('main input[type=color]')[1])");
    await exec("(() => { const el = document.querySelectorAll('main input[type=color]')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '#0B3D91'); el.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await esperar(2600);
    await foto('19-aparencia-cores');
    await exec("demo.clicar('Salvar aparencia', 'main')");
    await esperar(1500);
    await foto('20-aparencia-salva');
  });

  await cena('11-temas', async () => {
    await exec("demo.clicar('Temas')");
    await esperar(1200);
    await foto('15-temas');
    await exec("demo.clicar('Claro', 'main')");
    await esperar(1600);
    await foto('16-tema-claro');
    await exec("demo.clicar('Oceano', 'main')");
    await esperar(1500);
    await exec("demo.clicar('Rosa', 'main')");
    await esperar(1500);
    await exec("demo.clicar('Neon', 'main')");
    await esperar(800);
  });

  await cena('12-fim', async () => {
    await exec("demo.clicar('Relatorio')");
    await esperar(1000);
  });

  await exec('demo.legenda("")');
  await esperar(1200);
  capturando = false;
  await laco;
  console.log('quadros', quadros.length, 'duração', ((quadros[quadros.length - 1].t) / 1000).toFixed(0) + 's', 'tamanho', JSON.stringify(tamanho));

  const cfg = { w: tamanho.width, h: tamanho.height, quadros, falas };
  fs.writeFileSync(path.join(dirQuadros, 'cfg.json'), JSON.stringify(cfg));
  if (!process.argv.includes('--sem-video')) await montarVideo(cfg);
  app.quit();
});
