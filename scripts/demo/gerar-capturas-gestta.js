// Gera as capturas do manual (Express e Tarefa do Gestta) a partir das gravações de tela, já com o blur nos dados sensíveis.
// Uso: electron scripts/demo/gerar-capturas-gestta.js <Express.mp4> <Config Tarefa.mp4> <pasta-de-saida>
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const blur = require('./gestta-blur.js');

const [expressMp4, tarefaMp4, saida] = process.argv.slice(-3);

// [arquivo, vídeo, instante (s)]
const CAPTURAS = [
  ['g01-onvio-inicio', 'tarefa', 5], ['g02-onvio-aplicacoes', 'tarefa', 7.5], ['g03-gestta-dashboard', 'tarefa', 15],
  ['g04-gestta-avatar', 'express', 20], ['g05-codigo-acesso', 'express', 27.5], ['g06-express-icone', 'express', 30],
  ['g07-express-login', 'express', 35], ['g08-express-email', 'express', 40], ['g09-express-codigo', 'express', 50],
  ['g10-express-pronto', 'express', 52.5], ['g11-pasta-express', 'express', 62.5],
  ['g12-menu-configure', 'tarefa', 17.5], ['g13-recorrentes', 'tarefa', 25], ['g14-recorrentes-busca', 'tarefa', 32.5],
  ['g15-tarefa-detalhes', 'tarefa', 35.5], ['g16-tarefa-clientes', 'tarefa', 40], ['g17-tarefa-anexos', 'tarefa', 42.5],
  ['g18-template-lista', 'tarefa', 50], ['g19-template-regras', 'tarefa', 52.5], ['g20-template-validacoes', 'tarefa', 62.5],
  ['g21-template-salvo', 'tarefa', 67.5],
];

app.whenReady().then(async () => {
  fs.mkdirSync(saida, { recursive: true });
  const w = new BrowserWindow({ width: 400, height: 300, show: false, webPreferences: { webSecurity: false, offscreen: true } });
  await w.loadURL('data:text/html,<body></body>');
  const videos = { express: expressMp4, tarefa: tarefaMp4 };
  for (const nome of Object.keys(videos)) {
    await w.webContents.executeJavaScript(`new Promise((ok) => { window.v = document.createElement('video'); v.muted = true; v.onloadedmetadata = ok; v.src = ${JSON.stringify(pathToFileURL(videos[nome]).href)}; })`);
    for (const [arq, vid, t] of CAPTURAS.filter((c) => c[1] === nome)) {
      const regioes = blur[nome].filter((r) => t >= r.de && t < r.ate);
      const b64 = await w.webContents.executeJavaScript(`new Promise((ok) => {
        v.onseeked = () => { setTimeout(() => {
          const L = 1280, A = 960, c = document.createElement('canvas'); c.width = L; c.height = A; const g = c.getContext('2d');
          g.drawImage(v, 0, 0, L, A);
          for (const r of ${JSON.stringify(regioes)}) {
            g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
            g.filter = 'blur(26px)'; g.drawImage(v, 0, 0, L, A); g.filter = 'none';
            g.fillStyle = 'rgba(30,40,60,.42)'; g.fillRect(r.x, r.y, r.w, r.h); g.restore();
          }
          ok(c.toDataURL('image/jpeg', 0.9).split(',')[1]);
        }, 350); };
        v.currentTime = ${t};
      })`);
      fs.writeFileSync(path.join(saida, `${arq}.jpg`), Buffer.from(b64, 'base64'));
      console.log(arq, regioes.length, 'regiões');
    }
  }
  w.destroy();
  app.quit();
});
