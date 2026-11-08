import * as React from 'react';

interface Props {
  /** Gera o PDF e devolve em base64. */
  carregar: () => Promise<string>;
  /** Quando esse valor muda, o PDF é gerado e desenhado de novo. */
  chave: string;
  /** Chamado com o número de páginas quando o PDF fica pronto. */
  aoPronto?: (paginas: number) => void;
}

/**
 * Desenha o PDF página por página (pdf.js, carregado só quando precisa). É o mesmo arquivo que o "Salvar PDF" grava: o que
 * aparece aqui é o que sai no papel.
 */
export function PdfPaginas({ carregar, chave, aoPronto }: Props) {
  const areaRef = React.useRef<HTMLDivElement>(null);
  const carregarRef = React.useRef(carregar);
  carregarRef.current = carregar;
  const [estado, setEstado] = React.useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    let cancelado = false;
    setEstado((e) => (e === 'pronto' ? 'pronto' : 'carregando')); // atualizando: mantém o desenho anterior até o novo chegar
    setErro('');
    (async () => {
      try {
        const base64 = await carregarRef.current();
        const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelado) return;
        const escala = Math.min(2, (window.devicePixelRatio || 1) * 1.35);
        const canvases: HTMLCanvasElement[] = [];
        for (let n = 1; n <= doc.numPages && !cancelado; n++) {
          const pagina = await doc.getPage(n);
          const vista = pagina.getViewport({ scale: escala });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(vista.width);
          canvas.height = Math.floor(vista.height);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.className = 'rounded-md border border-border bg-white shadow-md';
          canvas.setAttribute('aria-label', `Página ${n} de ${doc.numPages}`);
          await pagina.render({ canvasContext: canvas.getContext('2d')!, viewport: vista }).promise;
          canvases.push(canvas);
        }
        if (cancelado) return;
        // troca tudo de uma vez, pra a tela não piscar vazia enquanto o PDF novo é desenhado
        areaRef.current?.replaceChildren(...canvases);
        setEstado('pronto');
        aoPronto?.(doc.numPages);
      } catch (e) {
        if (cancelado) return;
        setErro(e instanceof Error ? e.message : 'Não foi possível montar a pré-visualização.');
        setEstado('erro');
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return (
    <>
      {estado === 'carregando' && <p className="p-6 text-center text-sm text-muted-foreground">Montando o PDF…</p>}
      {estado === 'erro' && <p className="p-6 text-center text-sm text-destructive">{erro}</p>}
      <div ref={areaRef} className="flex flex-col gap-4" />
    </>
  );
}
