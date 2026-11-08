import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PdfPaginas } from '@/components/app-shell/pdf-paginas';

interface Props {
  open: boolean;
  onClose: () => void;
  titulo: string;
  descricao?: string;
  /** Gera o PDF e devolve em base64 (chamado a cada vez que o diálogo abre). */
  carregar: () => Promise<string>;
}

/** Pré-visualização do PDF do relatório num diálogo, página por página. Nada é gravado ao visualizar. */
export function PreviaPdfDialog({ open, onClose, titulo, descricao, carregar }: Props) {
  const [paginas, setPaginas] = React.useState(0);
  const [abertura, setAbertura] = React.useState(0);
  React.useEffect(() => { if (open) { setPaginas(0); setAbertura((n) => n + 1); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao ?? 'É assim que o PDF sai. Nada é gravado ao visualizar.'}{paginas > 0 ? ` · ${paginas} página${paginas > 1 ? 's' : ''}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--radius)] bg-secondary/50 p-3">
          {open && <PdfPaginas carregar={carregar} chave={String(abertura)} aoPronto={setPaginas} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
