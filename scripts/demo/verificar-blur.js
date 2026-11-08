// Confere o blur de gestta-blur.js: desenha os quadros do vídeo original nos instantes pedidos (já com o blur aplicado)
// e junta numa folha de contato 3x3 com o tempo de cada um. Olhe a folha: nenhum dado sensível pode aparecer.
// Uso: electron scripts/demo/verificar-blur.js <express|tarefa> <video.mp4> <pasta-saida> <de> <ate> <passo>
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const blur = require('./gestta-blur.js');

const [nome, video, saida, de, ate, passo] = process.argv.slice(-6);

app.whenReady().then(async () => {
  fs.mkdirSync(saida, { recursive: true });
  const w = new BrowserWindow({ width: 400, height: 300, show: false, webPreferences: { webSecurity: false, offscreen: true } });
  await w.loadURL('data:text/html,<body></body>');
  await w.webContents.executeJavaScript(`new Promise((ok) => { window.v = document.createElement('video'); v.muted = true; v.onloadedmetadata = ok; v.src = ${JSON.stringify(pathToFileURL(video).href)}; })`);
  const tempos = [];
  for (let t = Number(de); t <= Number(ate) + 1e-9; t += Number(passo)) tempos.push(Math.round(t * 100) / 100);
  let folha = 0;
  for (let i = 0; i < tempos.length; i += 9) {
    const grupo = tempos.slice(i, i + 9);
    const b64 = await w.webContents.executeJavaScript(`(async () => {
      const L = 640, A = 480, c = document.createElement('canvas'); c.width = L * 3; c.height = A * 3; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
      const regs = ${JSON.stringify(blur[nome])}, ts = ${JSON.stringify(grupo)};
      const q = document.createElement('canvas'); q.width = 1280; q.height = 960; const h = q.getContext('2d');
      for (let k = 0; k < ts.length; k++) {
        await new Promise((ok) => { v.onseeked = () => setTimeout(ok, 300); v.currentTime = ts[k]; });
        h.filter = 'none'; h.drawImage(v, 0, 0, 1280, 960);
        for (const r of regs) {
          if (ts[k] < r.de || ts[k] >= r.ate) continue;
          h.save(); h.beginPath(); h.rect(r.x, r.y, r.w, r.h); h.clip();
          h.filter = 'blur(26px)'; h.drawImage(v, 0, 0, 1280, 960); h.filter = 'none';
          h.fillStyle = 'rgba(30,40,60,.42)'; h.fillRect(r.x, r.y, r.w, r.h); h.restore();
        }
        const x = (k % 3) * L, y = Math.floor(k / 3) * A; g.drawImage(q, x, y, L, A);
        g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(x, y, 70, 20); g.fillStyle = '#fff'; g.font = '15px sans-serif'; g.fillText(ts[k] + 's', x + 5, y + 15);
      }
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    })()`);
    fs.writeFileSync(path.join(saida, `v${folha++}.jpg`), Buffer.from(b64, 'base64'));
  }
  console.log('folhas', folha);
  app.quit();
});
