// Converte documentacao/guia-de-uso.md em guia-de-uso.html e guia-de-uso.pdf (A4), com as capturas de tela.
// Uso: electron scripts/demo/gerar-guia-pdf.js <pasta-documentacao>
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { marked } = require('marked');

const pasta = process.argv[process.argv.length - 1];
const md = fs.readFileSync(path.join(pasta, 'guia-de-uso.md'), 'utf8');

const css = `
  @page { size: A4; margin: 16mm 14mm; }
  body { font: 11pt/1.5 "Segoe UI", Arial, sans-serif; color: #1c2430; }
  h1 { font-size: 24pt; margin: 0 0 6pt; color: #1351b4; } h2 { font-size: 15pt; margin-top: 22pt; border-bottom: 2px solid #1351b4; padding-bottom: 3pt; page-break-after: avoid; }
  h3 { font-size: 12pt; margin-top: 14pt; page-break-after: avoid; }
  img { max-width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; margin: 6pt 0; page-break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; margin: 8pt 0; page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 4pt 7pt; text-align: left; vertical-align: top; } th { background: #eef2f8; }
  code { background: #eef2f8; padding: 0 3pt; border-radius: 3pt; font-size: 90%; }
  pre { background: #eef2f8; padding: 8pt; border-radius: 6pt; overflow: hidden; } pre code { background: none; }
  blockquote { margin: 8pt 0; padding: 4pt 12pt; border-left: 4px solid #1351b4; background: #f3f6fc; color: #334155; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 14pt 0; }
`;
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Prazos — Guia de uso</title><style>${css}</style></head><body>${marked.parse(md)}</body></html>`;
fs.writeFileSync(path.join(pasta, 'guia-de-uso.html'), html);

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, width: 1100, height: 900 });
  await w.loadFile(path.join(pasta, 'guia-de-uso.html'));
  await new Promise((r) => setTimeout(r, 1500));
  const pdf = await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'default' }, displayHeaderFooter: true,
    headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#667489">Prazos — Guia de uso · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>' });
  fs.writeFileSync(path.join(pasta, 'guia-de-uso.pdf'), pdf);
  console.log('pdf', pdf.length);
  app.quit();
});