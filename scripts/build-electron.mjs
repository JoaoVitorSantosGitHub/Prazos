import { build } from 'esbuild';

// Processo principal e preload viram um arquivo cada. odbc (módulo nativo) e pdfkit (lê as fontes do próprio pacote em
// disco) ficam de fora do bundle e vão no node_modules do instalador.
const comum = { bundle: true, platform: 'node', target: 'node20', sourcemap: false, logLevel: 'info' };

await build({ ...comum, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.js', format: 'cjs', external: ['electron', 'odbc', 'pdfkit'] });
await build({ ...comum, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.js', format: 'cjs', external: ['electron'] });
