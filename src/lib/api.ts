// Ponte com o processo principal do Electron (ver electron/preload.ts). Toda chamada devolve o dado ou lança Error
// com a mensagem em português.
declare global {
  interface Window {
    api: { invocar<T>(canal: string, ...args: unknown[]): Promise<T> };
  }
}

export function chamar<T>(canal: string, ...args: unknown[]): Promise<T> {
  if (!window.api) return Promise.reject(new Error('Este app só funciona dentro da janela do Relatórios Domínio.'));
  return window.api.invocar<T>(canal, ...args);
}

export interface StatusDominio {
  dominioOk: boolean;
  latenciaMs?: number;
  mensagem?: string;
}

export interface PastaDestino {
  caminho: string;
  nome: string;
}
