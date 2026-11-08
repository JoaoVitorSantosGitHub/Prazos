// Usado só pela gravação do vídeo: gera o PDF de exemplo (mesmo código do app) pra a pré-visualização do demo.
import { APARENCIA_PADRAO, validarAparencia } from '../../electron/relatorio/aparencia';
import { exemploRelatorio } from '../../electron/relatorio/exemplo';
import { gerarPdf } from '../../electron/relatorio/relatorio-pdf';

export const padrao = () => APARENCIA_PADRAO;

export async function gerar(corpo: string | null, aparencia?: unknown): Promise<string> {
  const ap = aparencia ? validarAparencia(aparencia) : APARENCIA_PADRAO;
  return (await gerarPdf(exemploRelatorio(corpo && corpo.trim() ? corpo : null, ap.contatoAjuda), ap)).toString('base64');
}
