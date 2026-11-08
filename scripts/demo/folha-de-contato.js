// Junta vários quadros de um vídeo numa imagem só (grade 3x3 com o instante de cada um), pra ler uma gravação rápido.
// Uso: electron scripts/demo/folha-de-contato.js <video.mp4> <pasta-saida> <inicio-s> <fim-s> [passo-s=3]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const [video, saida, ini, fim, passoArg] = process.argv.slice(-5);
const passo = Number(passoArg) || 3;

app.whenReady().then(async () => {
  fs.mkdirSync(saida, { recursive: true });
  const w = new BrowserWindow({ width: 400, height: 300, show: false, webPreferences: { webSecurity: false, offscreen: true } });
  await w.loadURL('data:text/html,<body></body>');
  await w.webContents.executeJavaScript(`new Promise((ok) => { window.v = document.createElement('video'); v.muted = true; v.onloadedmetadata = ok; v.src = ${JSON.stringify(pathToFileURL(video).href)}; })`);
  const tempos = [];
  for (let t = Number(ini); t <= Number(fim); t += passo) tempos.push(t);
  let folha = 0;
  for (let i = 0; i < tempos.length; i += 9) {
    const grupo = tempos.slice(i, i + 9);
    const b64 = await w.webContents.executeJavaScript(`(async () => {
      const L = 640, A = 480, c = document.createElement('canvas'); c.width = L * 3; c.height = A * 3; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
      const ts = ${JSON.stringify(grupo)};
      for (let k = 0; k < ts.length; k++) {
        await new Promise((ok) => { v.onseeked = () => setTimeout(ok, 300); v.currentTime = ts[k]; });
        const x = (k % 3) * L, y = Math.floor(k / 3) * A; g.drawImage(v, x, y, L, A);
        g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(x, y, 60, 22); g.fillStyle = '#fff'; g.font = '16px sans-serif'; g.fillText(ts[k] + 's', x + 6, y + 16);
      }
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    })()`);
    fs.writeFileSync(path.join(saida, `folha${folha++}.jpg`), Buffer.from(b64, 'base64'));
  }
  console.log('folhas', folha);
  app.quit();
});
