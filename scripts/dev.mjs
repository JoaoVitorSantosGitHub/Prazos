import { spawn } from 'node:child_process';
import { createServer } from 'vite';

// Desenvolvimento: Vite com hot reload na janela do Electron (o processo principal é reconstruído a cada "npm run dev").
const servidor = await createServer();
await servidor.listen();
const url = servidor.resolvedUrls.local[0];

const build = spawn(process.execPath, ['scripts/build-electron.mjs'], { stdio: 'inherit' });
await new Promise((r) => build.on('exit', r));

const electron = (await import('electron')).default;
const app = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, RELATORIOS_DEV_URL: url } });
app.on('exit', async () => { await servidor.close(); process.exit(0); });
