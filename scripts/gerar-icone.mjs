// Gera build/icon.ico (e icon.png) a partir de build/icon.svg, renderizando o SVG numa janela invisível do Electron.
// Uso:  npx electron scripts/gerar-icone.mjs   (só precisa rodar de novo se o logo mudar)
import { app, BrowserWindow } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const svg = fs.readFileSync(path.join(raiz, 'build', 'icon.svg'), 'utf8');
const TAMANHOS = [256, 64, 48, 32, 16];

app.whenReady().then(async () => {
  // uma janela só, a 256 px; os tamanhos menores são reduções dessa captura
  const janela = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  const temp = path.join(app.getPath('temp'), 'icone-jvs.html');
  fs.writeFileSync(temp, `<html><body style="margin:0;background:transparent;overflow:hidden">${svg.replace('<svg ', '<svg width="256" height="256" ')}</body></html>`);
  await janela.loadFile(temp);
  await new Promise((r) => setTimeout(r, 500));
  const base = await janela.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });
  janela.destroy();
  const pngs = TAMANHOS.map((t) => ({ t, png: (t === 256 ? base : base.resize({ width: t, height: t, quality: 'best' })).toPNG() }));  fs.writeFileSync(path.join(raiz, 'build', 'icon.png'), pngs[0].png);

  // ICO com imagens PNG embutidas (aceito pelo Windows desde o Vista)
  const cab = Buffer.alloc(6);
  cab.writeUInt16LE(1, 2);
  cab.writeUInt16LE(pngs.length, 4);
  let deslocamento = 6 + 16 * pngs.length;
  const entradas = pngs.map(({ t, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(t >= 256 ? 0 : t, 0);
    e.writeUInt8(t >= 256 ? 0 : t, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(deslocamento, 12);
    deslocamento += png.length;
    return e;
  });
  fs.writeFileSync(path.join(raiz, 'build', 'icon.ico'), Buffer.concat([cab, ...entradas, ...pngs.map((p) => p.png)]));
  app.quit();
});
