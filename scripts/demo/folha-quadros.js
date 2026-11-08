// Junta quadros JPEG de uma pasta (a cada N) em folhas de contato 3x3, pra conferir uma gravação (principalmente o blur).
// Uso: electron scripts/demo/folha-quadros.js <pasta-de-quadros> <pasta-saida> <de-indice> <ate-indice> <passo>
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const [pasta, saida, de, ate, passo] = process.argv.slice(-5);

app.whenReady().then(async () => {
  fs.mkdirSync(saida, { recursive: true });
  const w = new BrowserWindow({ width: 400, height: 300, show: false, webPreferences: { webSecurity: false, offscreen: true } });
  await w.loadURL('data:text/html,<body></body>');
  const idx = [];
  for (let i = Number(de); i <= Number(ate); i += Number(passo)) idx.push(i);
  let folha = 0;
  for (let k = 0; k < idx.length; k += 9) {
    const grupo = idx.slice(k, k + 9).map((i) => ({ i, u: pathToFileURL(path.join(pasta, `${String(i).padStart(6, '0')}.jpg`)).href }));
    const b64 = await w.webContents.executeJavaScript(`(async () => {
      const L = 640, A = 400, c = document.createElement('canvas'); c.width = L * 3; c.height = A * 3; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
      const gr = ${JSON.stringify(grupo)};
      for (let n = 0; n < gr.length; n++) {
        const im = new Image(); await new Promise((ok) => { im.onload = ok; im.onerror = ok; im.src = gr[n].u; });
        const x = (n % 3) * L, y = Math.floor(n / 3) * A; g.drawImage(im, x, y, L, A);
        g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(x, y, 70, 20); g.fillStyle = '#fff'; g.font = '15px sans-serif'; g.fillText('#' + gr[n].i, x + 5, y + 15);
      }
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    })()`);
    fs.writeFileSync(path.join(saida, `folha${folha++}.jpg`), Buffer.from(b64, 'base64'));
  }
  console.log('folhas', folha);
  app.quit();
});
