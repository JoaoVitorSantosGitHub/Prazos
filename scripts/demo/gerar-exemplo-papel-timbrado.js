// Gera um papel timbrado de um escritório FICTÍCIO ("Escritório Exemplo") pra os vídeos, capturas e testes da aba Aparência:
// logo (PNG transparente), marca d'água (PNG) e rodapé (JPEG). Nada aqui é de um cliente real.
// Uso: electron scripts/demo/gerar-exemplo-papel-timbrado.js <pasta-de-saida>
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const saida = process.argv[process.argv.length - 1];
const AZUL = '#1D4ED8';
const CIANO = '#0891B2';

const PECAS = [
  {
    arquivo: 'logo.png', largura: 400, altura: 140, transparente: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140" viewBox="0 0 400 140">
      <rect x="8" y="14" width="112" height="112" rx="26" fill="${AZUL}"/>
      <path d="M38 98V42h44M38 70h34" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <rect x="62" y="84" width="44" height="13" rx="6" fill="${CIANO}"/>
      <text x="140" y="68" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="${AZUL}">Escritório</text>
      <text x="140" y="108" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="300" fill="${CIANO}">Exemplo</text>
    </svg>`,
  },
  {
    arquivo: 'marca-dagua.png', largura: 480, altura: 480, transparente: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
      <rect x="20" y="20" width="440" height="440" rx="100" fill="${AZUL}"/>
      <path d="M140 350V130h170M140 240h130" stroke="#fff" stroke-width="52" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <rect x="230" y="300" width="170" height="50" rx="25" fill="${CIANO}"/>
    </svg>`,
  },
  {
    arquivo: 'rodape.jpg', largura: 1440, altura: 176, transparente: false,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="176" viewBox="0 0 1440 176">
      <rect width="1440" height="176" fill="#fff"/>
      <g font-family="Segoe UI, Arial, sans-serif" font-size="30" text-anchor="middle" fill="#475569">
        <text x="360" y="68">Rua das Flores, 100 - Sala 2</text>
        <text x="360" y="108">Cidade Exemplo - UF</text>
      </g>
      <rect x="716" y="24" width="4" height="108" fill="${AZUL}"/>
      <g font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="#475569">
        <circle cx="796" cy="44" r="13" fill="${AZUL}"/><text x="826" y="55">@escritorioexemplo</text>
        <rect x="783" y="68" width="26" height="20" rx="3" fill="${AZUL}"/><text x="826" y="88">contato@escritorioexemplo.com.br</text>
        <circle cx="796" cy="116" r="13" fill="${AZUL}"/><text x="826" y="127">(00) 90000-0000</text>
      </g>
      <rect y="156" width="1440" height="20" fill="${AZUL}"/>
    </svg>`,
  },
];

app.whenReady().then(async () => {
  fs.mkdirSync(saida, { recursive: true });
  // uma janela só (carregar uma segunda janela depois de destruir a primeira falha no Electron oculto)
  const w = new BrowserWindow({ width: 1440, height: 480, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  for (const p of PECAS) {
    const temp = path.join(app.getPath('temp'), `peca-${p.arquivo.replace(/\./g, '-')}.html`);
    fs.writeFileSync(temp, `<html><body style="margin:0;background:transparent;overflow:hidden">${p.svg}</body></html>`);
    w.setContentSize(p.largura, p.altura);
    await w.loadFile(temp);
    await new Promise((r) => setTimeout(r, 600));
    const img = await w.webContents.capturePage({ x: 0, y: 0, width: p.largura, height: p.altura });
    fs.writeFileSync(path.join(saida, p.arquivo), p.arquivo.endsWith('.png') ? img.toPNG() : img.toJPEG(92));
    console.log('ok', p.arquivo);
  }
  w.destroy();
  app.quit();
});
