// Extrai quadros (JPEG) de um vídeo, de N em N segundos, e grava duracao.txt. Serve pra ler o conteúdo de gravações de tela.
// Uso: electron scripts/demo/extrair-quadros.js <video.mp4> <pasta-saida> [passo-em-segundos=5] [largura=1280]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const [video, saida, passoArg, largArg] = process.argv.slice(-4).length === 4 ? process.argv.slice(-4) : [...process.argv.slice(-3), undefined];
const passo = Number(passoArg) || 5;
const largura = Number(largArg) || 1280;

app.whenReady().then(async () => {
  fs.mkdirSync(saida, { recursive: true });
  const w = new BrowserWindow({ width: 400, height: 300, show: false, webPreferences: { webSecurity: false, offscreen: true, autoplayPolicy: 'no-user-gesture-required' } });
  await w.loadURL('data:text/html,<body></body>');
  const duracao = await w.webContents.executeJavaScript(`new Promise((ok, falha) => {
    window.v = document.createElement('video'); v.muted = true; v.preload = 'auto';
    v.onloadedmetadata = () => ok({ d: v.duration, w: v.videoWidth, h: v.videoHeight });
    v.onerror = () => falha(new Error('video: ' + (v.error && v.error.message)));
    v.src = ${JSON.stringify(pathToFileURL(video).href)};
  })`);
  console.log('duracao', duracao);
  fs.writeFileSync(path.join(saida, 'duracao.txt'), JSON.stringify(duracao));
  let n = 0;
  for (let t = 0; t < duracao.d; t += passo) {
    const b64 = await w.webContents.executeJavaScript(`new Promise((ok) => {
      v.onseeked = () => { const c = document.createElement('canvas'); const r = ${largura} / v.videoWidth; c.width = ${largura}; c.height = Math.round(v.videoHeight * r);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.8).split(',')[1]); };
      v.currentTime = ${t};
    })`);
    fs.writeFileSync(path.join(saida, `q${String(n++).padStart(3, '0')}-${String(Math.round(t)).padStart(4, '0')}s.jpg`), Buffer.from(b64, 'base64'));
  }
  console.log('quadros', n);
  w.destroy();
  app.quit();
});
