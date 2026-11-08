import { contextBridge, ipcRenderer } from 'electron';

// Ponte entre a tela e o processo principal. Cada chamada devolve o dado ou lança um Error com a mensagem em português.
async function invocar<T>(canal: string, ...args: unknown[]): Promise<T> {
  const r = (await ipcRenderer.invoke(canal, ...args)) as { ok: boolean; dados?: T; erro?: string };
  if (!r.ok) throw new Error(r.erro || 'Erro inesperado.');
  return r.dados as T;
}

contextBridge.exposeInMainWorld('api', {
  invocar,
});
